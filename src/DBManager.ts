var fs = require('fs');
var path = require('path');
var moment = require('moment');
var _ = require('lodash');
var sha256 = require('crypto-js/sha256');

import { User } from './models/User';
import { Address } from './models/Address';
import { Order } from './models/Order';
import mailerService from './mailerService';
import { Util } from './Util';

var dataPath = path.resolve(__dirname, "../data");
var ordersPath = path.resolve(dataPath, "orders.json");
var usersPath = path.resolve(dataPath, "users.json");
var addrPath = path.resolve(dataPath, "addresses.json");

class JsonIO {

    files: {[path: string]: any} = {};
    queue: {[path: string]: ((err?: any, json?: any) => any)[]} = {};

    private getJSON(path: string, cb: (err?: any, json?: any) => any) {
        if(this.files[path]) {
            if(!this.queue[path]) this.queue[path] = [cb];
            else this.queue[path].push(cb);
            return;
        }
        let json = require(path);
        this.files[path] = json;
        delete require.cache[path];
        cb(null, json);
    }

    private freeResource(path) {
        this.files[path] = undefined;
        if(this.queue[path]) {
            let cb = this.queue[path].shift();
            if(this.queue[path].length==0) this.queue[path] = undefined;
            this.getJSON(path, cb);
        }
    }

    private saveJSON(path, obj, cb: (err?: any) => any) {
        fs.writeFile(path, JSON.stringify(obj, null, 4), (err?: any) => {
            this.freeResource(path);
            cb(err);
        });
    }

    getOrder(id, cb: (err?: any, order?: Order) => any) {
        this.getJSON(ordersPath, (err?: any, json?: any) => {
            if(err) {
                this.freeOrders();
                cb(err);
            } else cb(null, json[id]);
        });
    }

    private getOrders(cb: (err?: any, json?: any) => any) {
        this.getJSON(ordersPath, cb);
    }

    getOrderList(cb: (err?: any, orders?: string[]) => any) {
        this.getOrders((err?: any, json?: any) => {
            this.freeOrders();
            if(err) cb(err);
            else cb(null, Object.keys(json));
        });
    }

    saveOrders(orders, cb: (err?: any) => any) {
        this.saveJSON(ordersPath, orders, cb);
    }

    saveOrder(order: Order, cb: (err?: any, id?: number) => any) {
        let id = order.id;
        this.getOrders((err, orders) => {
            if(err){
                this.freeOrders();
                cb(err);
            } else {
                orders[id] = order;
                this.saveOrders(orders, err => {
                    cb(err, id);
                });
            }
        });
    }

    freeOrders() {
        this.freeResource(ordersPath);
    }

    getUser(cpf, cb: (err?: any, user?: User) => any) {
        this.getJSON(usersPath, (err?: any, json?: any) => {
            if(err) {
                this.freeUsers();
                cb(err);
            } else cb(null, json[cpf]);
        });
    }

    private getUsers(cb: (err?: any, json?: any) => any) {
        this.getJSON(usersPath, cb);
    }

    getUserList(cb: (err?: any, users?: string[]) => any) {
        this.getUsers((err?: any, json?: any) => {
            this.freeUsers();
            if(err) cb(err);
            else cb(null, Object.keys(json));
        });
    }
    
    saveUsers(users, cb: (err?: any) => any) {
        this.saveJSON(usersPath, users, cb);
    }

    saveUser(user: User, cb: (err?: any, cpf?: string) => any) {
        let cpf = user.cpf;
        this.getUsers((err, users) => {
            if(err){
                this.freeUsers();
                cb(err);
            } else {
                users[cpf] = user;
                this.saveUsers(users, err => {
                    cb(err, cpf);
                });
            }
        });
    }

    freeUsers() {
        this.freeResource(usersPath);
    }

    getAddressByHash(hash, cb: (err?: any, address?: Address) => any) {
        this.getJSON(addrPath, (err?: any, json?: any) => {
            if(err) {
                this.freeAddresses();
                cb(err);
            } else cb(null, json[hash]);
        });
    }

    getAddressByCpf(cpf, cb: (err?: any, address?: Address) => any) {
        this.getUser(cpf, (err, user) => {
            this.freeUsers();
            if(err) cb(err);
            else {
                if(!user) err = "Este CPF não está registrado";
                else if(!user.address) err = "Este CPF não tem endereço registrado";

                if(err) cb(err);
                else this.getAddressByHash(user.address, (err, address) => {
                    cb(err, address);
                });
            }
        });
    }

    private getAddresses(cb: (err?: any, json?: any) => any) {
        this.getJSON(addrPath, cb);
    }
    
    saveAddresses(addresses, cb: (err?: any) => any) {
        this.saveJSON(addrPath, addresses, cb);
    }

    saveAddress(address: Address, cb: (err?: any, hash?: string) => any) {
        let hash = address.getHash();
        this.getAddresses((err, addresses) => {
            if(err || addresses[hash]){
                this.freeAddresses();
                cb(err, hash);
            } else {
                addresses[hash] = address;
                this.saveAddresses(addresses, err => {
                    cb(err, hash);
                });
            }
        });
    }

    freeAddresses() {
        this.freeResource(addrPath);
    }
}

export var jsonIO = new JsonIO();

class DataIO {

    validate(cpf, session, cb: (err?: any) => any) {
        jsonIO.getUser(cpf, (err, user) => {
            if(err) cb(err);
            else {
                jsonIO.freeUsers();
                let validate = Util.validateSession(user, session);
                if(!cpf || !session) err = "Você precisa estar logado para fazer isso";
                else if(!user) err = "Este CPF não está registrado";
                else if(validate == 1) err = "Checar backend!";
                else if(validate == 2) err = "Não existe sessão para este usuário";
                else if(validate == 3) err = "O hash de sessão não confere";
                else if(validate == 4) err = "A sessão expirou";
                cb(err);
            }
        });
    }

    postOrder(cpf, products, address, cb: (err?: any, id?: number) => any) {

        const processAndSaveOrder = (err, address) => {
            jsonIO.getOrderList((err, orders) => {
                let todayHash = parseInt(moment().format("YYMMDD0000"));
                let todays = _.filter(orders, order => order >= todayHash);
                let serial = todays.length;
                let id = todayHash + serial;
                let order = new Order(id, cpf, address, products);
                jsonIO.saveOrder(order, cb);
            });
        }

        this.getUserExists(cpf, (err, userData) => {
            if(err) cb(err);
            else {
                if(!userData.exists) err = "Este CPF não está registrado";
                else if(!address) err = "Não foi informado nenhum endereço";
                if(err) cb(err);
                else {
                    let addressObj = new Address(address.line1, address.line2, address.neigh, address.city, address.state, address.code);
                    jsonIO.saveAddress(addressObj, processAndSaveOrder);
                }
            }
        });
    }

    getUserExists(cpf, cb: (err?: any, data?: {exists?: boolean, registered?: boolean}) => any) {
        jsonIO.getUser(cpf, (err, user) => {
            if(err) cb(err);
            else {
                jsonIO.freeUsers();
                let data: {
                    exists?: boolean,
                    registered?: boolean
                } = {}
                if(user) {
                    data.exists = true;
                    if(user.confirmedEmail) data.registered = true
                }
                cb(err, data);
            }
        });
    }
    
    postUser(name, cpf, password, email, cb: (err?: any) => any) {
        this.getUserExists(cpf, (err, userData) => {
            if(err) cb(err);
            else {
                password = Util.addSalt(password);
                if(!name) err = {name: "Usuário precisa de nome"};
                else if(!email) err = {email: "Usuário precisa de email"};
                else if(userData.exists) err = {cpf: "Este CPF já foi registrado"};
                else if(!err && !Util.validateCPF(cpf)) err = {cpf: "CPF não é válido"};
                if(err) {
                    cb(err);
                } else {
                    let user = new User(name, cpf, password, email);
                    jsonIO.saveUser(user, (err, cpf) => {
                        if(err) cb(err);
                        else {
                            mailerService.sendConfirmSignUp(email, name, cpf, user.confirmCode);
                            cb();
                        }
                    });
                }
            }
        });
    }

    resubmitConfirmSignUp(cpf, cb: (err?: any) => any) {
        jsonIO.getUser(cpf, (err, user) => {
            if(err) cb(err);
            else {
                jsonIO.freeUsers();
                if(!user) err = {cpf: "Este CPF não foi registrado"};
                if(err) {
                    cb(err);
                } else {
                    let name = user.name;
                    let email = user.email;
                    let confirmCode = user.confirmCode;
                    mailerService.sendConfirmSignUp(email, name, cpf, confirmCode);
                }
            }
        });
    }

    postAddress(cpf, address, cb: (err?: any) => any) {
        jsonIO.getUser(cpf, (err, user) => {
            if(err) cb(err);
            else {
                if(!user) err = "Este CPF não está registrado";
                var {
                    line1,
                    line2,
                    neigh,
                    city,
                    state,
                    code
                } = address;
                code = code ? code.toString().replace(/[^\d]+/g,'') : "";
                if(!line1 || line1.length==0 || !neigh || neigh.length==0 || !city || city.length==0 || !state || state.length==0 || !code || code.length==0)
                    err = "Algum campo obrigatório não foi preenchido";
                if(err) {
                    jsonIO.freeUsers();
                    cb(err);
                } else {
                    var addressObj = new Address(line1, line2, neigh, city, state, code);
                    jsonIO.saveAddress(addressObj, (err, hash) => {
                        user.setAddress(hash);
                        jsonIO.saveUser(user, cb);
                    });
                }
            }
        });
    }

    postChangePassword(cpf, oldPass, newPass, cb: (err?: any) => any) {
        jsonIO.getUser(cpf, (err, user) => {
            if(err) cb(err);
            else {
                oldPass = Util.addSalt(oldPass);
                newPass = Util.addSalt(newPass);
                if(!user) err = "Este CPF não está registrado";
                if(user.password !== oldPass) err = "Senha errada";
                if(err) {
                    jsonIO.freeUsers();
                    cb(err);
                } else {
                    user.password = newPass;
                    jsonIO.saveUser(user, cb);
                }
            }
        });
    }

    postLogin(cpf, password, cb: (err?: any, data?: {hash: string, user: {name: string, cpf: number, email?: string, address?: string, orders?: string[]}}) => any) {
        jsonIO.getUser(cpf, (err, user) => {
            if(err) cb(err);
            else {
                password = Util.addSalt(password);
                if(!user || user.password == Util.blankPass()) err = {cpf: "Este CPF não está registrado"};
                else if(user.password !== password) err = {pass: "Senha errada"};
                if(err) {
                    cb(err);
                } else {
                    let sessionHash = user.registerNewSession();
                    let keys = user.confirmedEmail ? ["name", "cpf", "email", "address", "orders"] : ["name", "cpf"];
                    let userToSend = _.pickBy(user, (value, key) => {
                        return keys.indexOf(key) >= 0;
                    });
                    jsonIO.saveUser(user, err => {
                        cb(err, {hash: sessionHash, user: userToSend});
                    });
                }
            }
        });
    }

}

export var dataIO = new DataIO();