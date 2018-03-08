var fs = require('fs');
var path = require('path');
var moment = require('moment');
var _ = require('lodash');
var sha256 = require('crypto-js/sha256');

import User from './models/User';
var Address = require('./models/Address');
import mailerService from './mailerService';
import Util from './Util';

var dataPath = path.resolve(__dirname, "../data");
var ordersPath = path.resolve(dataPath, "orders.json");
var usersPath = path.resolve(dataPath, "users.json");
var addrPath = path.resolve(dataPath, "addresses.json");

function getJSON(path) {
    var json = require(path);
    delete require.cache[path];
    return json;
}

function callback(cb, err, data?) {
    if(cb && typeof cb == "function") cb(err, data);
}

function saveOrders(orders, cb, data?) {
    fs.writeFile(ordersPath, JSON.stringify(orders, null, 4), err => {
        callback(cb, err, data);
    });
}

function saveUsers(users, cb, data?) {
    fs.writeFile(usersPath, JSON.stringify(users, null, 4), err => {
        callback(cb, err, data);
    });
}

function saveAddresses(addresses, cb, data?) {
    fs.writeFile(addrPath, JSON.stringify(addresses, null, 4), err => {
        callback(cb, err, data);
    })
}

export default class DBManager {

    static validate(cpf, session, cb?) {
        var err;
        var user = getJSON(usersPath)[cpf];
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
        return getJSON(ordersPath)[id];
    }

    static postOrder(cpf, products, address, cb) {

        const processAndSaveOrder = (addrHash) => {
            var orders = getJSON(ordersPath);
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

            saveOrders(orders, err => {
                if(err) callback(cb, err);
                else {
                    var user = users[cpf];
                    if(!user.orders) user.orders = [];
                    user.orders.push(id);
                    saveUsers(users, cb, id);
                }
            });
        }

        var err;
        var users = getJSON(usersPath);
        var user = users[cpf];
        if(!user) err = "Este CPF não está registrado";
        else if(!address) err = "Não foi informado nenhum endereço";
        if(err) {
            callback(cb, err);
        } else {
            var addresses = getJSON(addrPath);
            var address = new Address(address.line1, address.line2, address.neigh, address.city, address.state, address.code);
            var addrHash = address.getHash();
            if(!addresses[addrHash]) {
                addresses[addrHash] = address;
                saveAddresses(addresses, err => {
                    if(err) callback(cb, err);
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
        return getJSON(ordersPath);
    }

    static getUser(cpf) {
        return getJSON(usersPath)[cpf];
    }

    static getUserExists(cpf, cb?) {
        var err;
        let users = getJSON(usersPath);
        let user = users[cpf];
        if(err) {
            callback(cb, err);
        } else {
            let data = {
                exists: false,
                registered: false
            }
            if(user) {
                data.exists = true;
                if(user.confirmedEmail) data.registered = true
            }
            callback(cb, err, data);
        }
    }
    
    static postUser(name, cpf, password, email, cb) {
        console.log('posting user')
        var err;
        var users = getJSON(usersPath);
        password = Util.addSalt(password);
        if(!name) err = {name: "Usuário precisa de nome"};
        else if(!email) err = {email: "Usuário precisa de email"};
        else if(users[cpf]) err = {cpf: "Este CPF já foi registrado"};
        else if(!err && !Util.validateCPF(cpf)) err = {cpf: "CPF não é válido"};
        if(err) {
            callback(cb, err);
        } else {
            var user = new User(name, cpf, password, email);
            users[cpf] = user;
            saveUsers(users, cb);
            mailerService.sendConfirmSignUp(email, name, cpf, user.confirmCode);
        }
    }

    static resubmitConfirmSignUp(cpf, cb?) {
        let err;
        let user = getJSON(usersPath)[cpf];
        if(!user) err = {cpf: "Este CPF não foi registrado"};
        if(err) {
            callback(cb, err);
        } else {
            let name = user.name;
            let email = user.email;
            let confirmCode = user.confirmCode;
            mailerService.sendConfirmSignUp(email, name, cpf, confirmCode);
        }
    }

    static getUserList() {
        return getJSON(usersPath);
    }

    static getAddressByHash(hash) {
        return getJSON(addrPath)[hash];
    }

    static getAddressByCpf(cpf, cb) {
        var err;
        var user = getJSON(usersPath)[cpf];
        if(!user) err = "Este CPF não está registrado";
        if(!user.address) callback(cb, err, undefined);
        else callback(cb, err, DBManager.getAddressByHash(user.address));
    }

    static postAddress(cpf, address, cb) {
        var err;
        var users = getJSON(usersPath);
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
            callback(cb, err);
        } else {
            var address = new Address(line1, line2, neigh, city, state, code);
            var addrHash = address.getHash();
            var addr = getJSON(addrPath);
            if(addr[addrHash]) {
                user.address = addrHash;
                saveUsers(users, cb);
            } else {
                addr[addrHash] = address;
                saveAddresses(addr, err => {
                    if(err) callback(cb, err);
                    else {
                        user.address = addrHash;
                        saveUsers(users, cb);
                    }
                });
            }
        }
    }

    static postChangePassword(cpf, oldPass, newPass, cb) {
        var err;
        var users = getJSON(usersPath);
        var user = users[cpf];
        oldPass = Util.addSalt(oldPass);
        newPass = Util.addSalt(newPass);
        if(!user) err = "Este CPF não está registrado";
        if(user.password && user.password !== oldPass) err = "Senha errada";
        if(err) {
            callback(cb, err);
        } else {
            user.password = newPass;
            saveUsers(users, cb);
        }
    }

    static postLogin(cpf, password, cb) {
        var err;
        var users = getJSON(usersPath);
        var user = users[cpf];
        password = Util.addSalt(password);
        if(!user || user.password == Util.blankPass()) err = {cpf: "Este CPF não está registrado"};
        else if(user.password && user.password !== password) err = {pass: "Senha errada"};
        if(err) {
            callback(cb, err);
        } else {
            var timestamp = Date.now();
            var timestr = timestamp + "";
            var toHash = timestr + user.cpf + user.name;
            var hash = sha256(toHash).toString();
            user.session = {
                timestamp: timestamp,
                hash: hash
            }
            saveUsers(users, cb, hash);
        }
    }

}