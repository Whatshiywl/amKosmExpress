import * as moment from 'moment';
import * as _ from 'lodash';

import dbManager from './DBManager';
import { Order } from './models/Order';
import { Address } from './models/Address';
import { User } from './models/User';
import { Util } from './Util'; 
import mailerService from './mailerService';

class DataIO {

    validate(cpf, session, cb: (err?: any) => any) {
        dbManager.getUser(cpf, (err, user) => {
            if(err) cb(err);
            else {
                dbManager.freeUsers();
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
            dbManager.getOrderList((err, orders) => {
                let todayHash = parseInt(moment().format("YYMMDD0000"));
                let todays = _.filter(orders, order => order >= todayHash);
                let serial = todays.length;
                let id = todayHash + serial;
                let order = new Order(id, cpf, address, products);
                dbManager.saveOrder(order, cb);
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
                    dbManager.saveAddress(addressObj, processAndSaveOrder);
                }
            }
        });
    }

    getUserExists(cpf, cb: (err?: any, data?: {exists?: boolean, registered?: boolean}) => any) {
        dbManager.getUser(cpf, (err, user) => {
            if(err) cb(err);
            else {
                dbManager.freeUsers();
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
                    dbManager.saveUser(user, (err, cpf) => {
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
        dbManager.getUser(cpf, (err, user) => {
            if(err) cb(err);
            else {
                dbManager.freeUsers();
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
        dbManager.getUser(cpf, (err, user) => {
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
                    dbManager.freeUsers();
                    cb(err);
                } else {
                    var addressObj = new Address(line1, line2, neigh, city, state, code);
                    dbManager.saveAddress(addressObj, (err, hash) => {
                        user.setAddress(hash);
                        dbManager.saveUser(user, cb);
                    });
                }
            }
        });
    }

    postChangePassword(cpf, oldPass, newPass, cb: (err?: any) => any) {
        dbManager.getUser(cpf, (err, user) => {
            if(err) cb(err);
            else {
                oldPass = Util.addSalt(oldPass);
                newPass = Util.addSalt(newPass);
                if(!user) err = "Este CPF não está registrado";
                if(user.password !== oldPass) err = "Senha errada";
                if(err) {
                    dbManager.freeUsers();
                    cb(err);
                } else {
                    user.password = newPass;
                    dbManager.saveUser(user, cb);
                }
            }
        });
    }

    postLogin(cpf, password, cb: (err?: any, data?: {hash: string, user: {name: string, cpf: number, email?: string, address?: string, orders?: string[]}}) => any) {
        dbManager.getUser(cpf, (err, user) => {
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
                    dbManager.saveUser(user, err => {
                        cb(err, {hash: sessionHash, user: userToSend});
                    });
                }
            }
        });
    }

}

export default new DataIO();