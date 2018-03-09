import { Util } from '../Util';

export class User {
    name;
    cpf;
    password;
    address;
    orders;
    registerTime;
    email;
    confirmedEmail;
    confirmCode;
    session;
    
    constructor(name, cpf, password, email) {
        let time = Date.now();
        this.name = name;
        this.cpf = cpf;
        this.password = password;
        this.registerTime = time;
        this.email = email;
        this.confirmedEmail = false;
        this.confirmCode = Util.addSalt(`email${time}${cpf}confirm${password}${email}code`);
    }

    setAddress(address: string) {
        this.address = address;
    }

    registerNewSession(): string {
        let timestamp = Date.now();
        let timestr = timestamp + "";
        let toHash = timestr + this.cpf + this.name;
        let hash = Util.addSalt(`session${toHash}hash`);
        this.session = {
            timestamp: timestamp,
            hash: hash
        }
        return hash;
    }
}