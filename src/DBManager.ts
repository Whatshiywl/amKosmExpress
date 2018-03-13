import * as fs from 'fs';
let path = require('path');
import * as _ from 'lodash';

import { User } from './models/User';
import { Address } from './models/Address';
import { Order } from './models/Order';

let dataPath = path.resolve(__dirname, "./data");
let ordersPath = path.resolve(dataPath, "orders.json");
let usersPath = path.resolve(dataPath, "users.json");
let addrPath = path.resolve(dataPath, "addresses.json");

class DBManager {

    readonly MAXFILESIZE = 1000; // in bytes

    files: {[path: string]: any} = {};
    queue: {[path: string]: ((err?: any, json?: any) => any)[]} = {};

    constructor() {
        this.init(['test.json'], err => {
            if(err) console.error(err);
            else console.log("Database init success");
        });
    }

    init(collections: string[], callback: (err?: any) => any) {
        fs.mkdir(dataPath, err => {
            if(err && err.code != "EEXIST") {
                console.error(err);
                callback("Error creating data directory");
            } else {
                this.initFiles(collections, callback);
            }
        });
    }

    private initFiles(files: string[], callback: (err?: any) => any) {
        let n = files.length;
        let i = 0;
        _.forEach(files, (file: string) => {
            if(!_.endsWith(file, ".json")) file += ".json";
            let filePath = path.resolve(dataPath, file);
            this.initFile(filePath, err => {
                if(err) { 
                    console.error(err);
                    callback("Database init error");
                    return false;
                } else i++;
                if(i == n) callback();
            });
        });
    }

    private initFile(filePath: string, callback: (err?: any) => any) {
        let paths = filePath.split(path.delimiter);
        let file = paths[paths.length-1];
        fs.stat(filePath, (err, stats: fs.Stats) => {
            if(err) {
                if(err.code == "ENOENT") {
                    fs.writeFile(filePath, JSON.stringify({}, null, 4), err => {
                        if(err) {
                            console.error(err);
                            callback("Error creating file " + file);
                        } else callback();
                    });
                } else {
                    console.error(err);
                    callback("Error accessing file " + file);
                }
            } else {
                if(stats.size > this.MAXFILESIZE) {
                    console.warn(`${file} is too long (${stats.size} bytes). Sharding...`);
                    this.shard(filePath, (err, files) => {
                        if(err) {
                            console.error(err);
                            callback(`Error sharding ${file}`);
                        } else if(files && files.length > 0) {
                            this.initFiles(files, callback);
                        } else {
                            callback();
                        }
                    });
                } else {
                    callback();
                }
            }
        });
    }

    private shard(filePath: string, callback: (err?: any, files?: string[]) => any) {
        this.getJSON(filePath, (err, json) => {
            if(err) {
                console.error(err);
                callback(err);
            } else {
                let folderPath = filePath.substring(0, filePath.length-5);
                fs.mkdir(folderPath, err => {
                    if(err && err.code != "EEXIST") { 
                        console.error(err);
                        callback(`Error creating folder ${folderPath}`);
                    } else {
                        let paths = [];
                        let keys = Object.keys(json) as string[];
                        _.forEach(keys, (key: string) => {
                            let p = path.resolve(folderPath, key + ".json");
                            fs.writeFile(p, JSON.stringify(json[key], null, 4), err => {
                                if(err) {
                                    console.error();
                                    callback(`Error creating json ${key}`);
                                    return false;
                                } else {
                                    paths.push(p);
                                }
                                if(paths.length == keys.length) {
                                    fs.unlink(filePath, err => {
                                        if(err) console.error(`Error deleting ${filePath}`); 
                                        else callback(null, paths);
                                    });
                                }
                            });
                        });
                    }
                });
            }
        });
    }

    private getJSON(path: string, cb: (err?: any, json?: any) => any) {
        // if(this.files[path]) {
        //     if(!this.queue[path]) this.queue[path] = [cb];
        //     else this.queue[path].push(cb);
        //     return;
        // }
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

export default new DBManager();