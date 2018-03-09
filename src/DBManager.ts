var fs = require('fs');
var path = require('path');
var moment = require('moment');
var _ = require('lodash');
var sha256 = require('crypto-js/sha256');

import { User } from './models/User';
import { Address } from './models/Address';
import mailerService from './mailerService';
import { Util } from './Util';

var dataPath = path.resolve(__dirname, "../data");
var ordersPath = path.resolve(dataPath, "orders.json");
var usersPath = path.resolve(dataPath, "users.json");
var addrPath = path.resolve(dataPath, "addresses.json");

class DBManager {

    getJSON(path) {
        var json = require(path);
        delete require.cache[path];
        return json;
    }
    
    saveOrders(orders, cb: (err: any) => any) {
        fs.writeFile(ordersPath, JSON.stringify(orders, null, 4), cb);
    }
    
    saveUsers(users, cb: (err: any) => any) {
        fs.writeFile(usersPath, JSON.stringify(users, null, 4), cb);
    }
    
    saveAddresses(addresses, cb: (err: any) => any) {
        fs.writeFile(addrPath, JSON.stringify(addresses, null, 4), cb);
    }
}

var dbManager = new DBManager();

export class DataIO {

    static validate(cpf, session) {
        var err;
        var user = dbManager.getJSON(usersPath)[cpf];
        var validate = Util.validateSession(user, session);
        if(!cpf || !session) err = "Você precisa estar logado para fazer isso";
        else if(!user) err = "Este CPF não está registrado";
        else if(validate == 1) err = "Checar backend!";
        else if(validate == 2) err = "Não existe sessão para este usuário";
        else if(validate == 3) err = "O hash de sessão não confere";
        else if(validate == 4) err = "A sessão expirou";
        return err;
    }

    static getOrder(id) {
        return dbManager.getJSON(ordersPath)[id];
    }

    static postOrder(cpf, products, address, cb: (err: any, id?: number) => any) {

        const processAndSaveOrder = (addrHash) => {
            var orders = dbManager.getJSON(ordersPath);
            var todayHash = parseInt(moment().format("YYMMDD0000"));
            var todays = _.filter(Object.keys(orders), key => key >= todayHash);
            var serial = todays.length;
            var id = todayHash + serial;
            orders[id] = {
                status: 0,
                cpf: cpf,
                address: addrHash,
                products: products
            }

            dbManager.saveOrders(orders, err => {
                if(err) cb(err);
                else {
                    var user = users[cpf];
                    if(!user.orders) user.orders = [];
                    user.orders.push(id);
                    dbManager.saveUsers(users, err => {
                        cb(err, id);
                    });
                }
            });
        }

        var err;
        var users = dbManager.getJSON(usersPath);
        var user = users[cpf];
        if(!user) err = "Este CPF não está registrado";
        else if(!address) err = "Não foi informado nenhum endereço";
        if(err) {
            cb(err);
        } else {
            var addresses = dbManager.getJSON(addrPath);
            var addressObj = new Address(address.line1, address.line2, address.neigh, address.city, address.state, address.code);
            var addrHash = addressObj.getHash();
            if(!addresses[addrHash]) {
                addresses[addrHash] = addressObj;
                dbManager.saveAddresses(addresses, err => {
                    if(err) cb(err);
                    else {
                        processAndSaveOrder(addrHash);
                    }
                });
            } else {
                processAndSaveOrder(addrHash);
            }
        }
    }

    static getOrderList() {
        return dbManager.getJSON(ordersPath);
    }

    static getUser(cpf) {
        return dbManager.getJSON(usersPath)[cpf];
    }

    static getUserExists(cpf, cb: (err: any, data?: {exists: boolean, registered: boolean}) => any) {
        var err;
        let users = dbManager.getJSON(usersPath);
        let user = users[cpf];
        if(err) {
            cb(err);
        } else {
            let data = {
                exists: false,
                registered: false
            }
            if(user) {
                data.exists = true;
                if(user.confirmedEmail) data.registered = true
            }
            cb(err, data);
        }
    }
    
    static postUser(name, cpf, password, email, cb: (err: any) => any) {
        var err;
        var users = dbManager.getJSON(usersPath);
        password = Util.addSalt(password);
        if(!name) err = {name: "Usuário precisa de nome"};
        else if(!email) err = {email: "Usuário precisa de email"};
        else if(users[cpf]) err = {cpf: "Este CPF já foi registrado"};
        else if(!err && !Util.validateCPF(cpf)) err = {cpf: "CPF não é válido"};
        if(err) {
            cb(err);
        } else {
            var user = new User(name, cpf, password, email);
            users[cpf] = user;
            dbManager.saveUsers(users, cb);
            mailerService.sendConfirmSignUp(email, name, cpf, user.confirmCode);
        }
    }

    static resubmitConfirmSignUp(cpf, cb: (err: any) => any) {
        let err;
        let user = dbManager.getJSON(usersPath)[cpf];
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

    static getUserList() {
        return dbManager.getJSON(usersPath);
    }

    static getAddressByHash(hash) {
        return dbManager.getJSON(addrPath)[hash];
    }

    static getAddressByCpf(cpf, cb: (err: any, address?: Address) => any) {
        var err;
        var user = dbManager.getJSON(usersPath)[cpf];
        if(!user) err = "Este CPF não está registrado";
        if(!user.address) cb(err);
        else cb(err, DataIO.getAddressByHash(user.address));
    }

    static postAddress(cpf, address, cb: (err: any) => any) {
        var err;
        var users = dbManager.getJSON(usersPath);
        var user = users[cpf];
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
            cb(err);
        } else {
            var addressObj = new Address(line1, line2, neigh, city, state, code);
            var addrHash = addressObj.getHash();
            var addr = dbManager.getJSON(addrPath);
            if(addr[addrHash]) {
                user.address = addrHash;
                dbManager.saveUsers(users, cb);
            } else {
                addr[addrHash] = addressObj;
                dbManager.saveAddresses(addr, err => {
                    if(err) cb(err);
                    else {
                        user.address = addrHash;
                        dbManager.saveUsers(users, cb);
                    }
                });
            }
        }
    }

    static postChangePassword(cpf, oldPass, newPass, cb: (err: any) => any) {
        var err;
        var users = dbManager.getJSON(usersPath);
        var user = users[cpf];
        oldPass = Util.addSalt(oldPass);
        newPass = Util.addSalt(newPass);
        if(!user) err = "Este CPF não está registrado";
        if(user.password && user.password !== oldPass) err = "Senha errada";
        if(err) {
            cb(err);
        } else {
            user.password = newPass;
            dbManager.saveUsers(users, cb);
        }
    }

    static postLogin(cpf, password, cb: (err: any, data?: {hash: string, user: {name: string, cpf: number, email?: string, address?: string, orders?: string[]}}) => any) {
        var err;
        var users = dbManager.getJSON(usersPath);
        var user = users[cpf];
        password = Util.addSalt(password);
        if(!user || user.password == Util.blankPass()) err = {cpf: "Este CPF não está registrado"};
        else if(user.password && user.password !== password) err = {pass: "Senha errada"};
        if(err) {
            cb(err);
        } else {
            var timestamp = Date.now();
            var timestr = timestamp + "";
            var toHash = timestr + user.cpf + user.name;
            var hash = sha256(toHash).toString();
            user.session = {
                timestamp: timestamp,
                hash: hash
            }

            let keys = user.confirmedEmail ? ["name", "cpf", "email", "address", "orders"] : ["name", "cpf"];
            let userToSend = _.pickBy(user, (value, key) => {
                return keys.indexOf(key) >= 0;
            });
            dbManager.saveUsers(users, err => {
                cb(err, {hash: hash, user: userToSend});
            });
        }
    }

}