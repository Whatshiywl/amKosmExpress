import { Util } from '../Util';

export class User {
    name;
    cpf;
    password;
    registerTime;
    email;
    confirmedEmail;
    confirmCode;
    
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
}