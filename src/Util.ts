var sha256 = require('crypto-js/sha256');
var lodash = require('lodash');

export default class Util {

    static validateCPF(cpf) {
        if(cpf == '') return false; 
        // Elimina CPFs invalidos conhecidos    
        if (cpf.length != 11 || 
            cpf == "00000000000" || 
            cpf == "11111111111" || 
            cpf == "22222222222" || 
            cpf == "33333333333" || 
            cpf == "44444444444" || 
            cpf == "55555555555" || 
            cpf == "66666666666" || 
            cpf == "77777777777" || 
            cpf == "88888888888" || 
            cpf == "99999999999")
                return false;       
        // Valida 1o digito 
        var add = 0;    
        for (var i=0; i < 9; i ++) {
            add += parseInt(cpf.charAt(i)) * (10 - i); 
        } 
        var rev = 11 - (add % 11);  
        if (rev == 10 || rev == 11)     
            rev = 0;    
        if (rev != parseInt(cpf.charAt(9)))     
            return false;
        // Valida 2o digito 
        add = 0;    
        for (var i = 0; i < 10; i ++) { 
            add += parseInt(cpf.charAt(i)) * (11 - i);  
        }
        var rev = 11 - (add % 11);  
        if (rev == 10 || rev == 11) 
            rev = 0;    
        if (rev != parseInt(cpf.charAt(10)))
            return false;
        return true;  
    }

    static validateSession(user, hash) {
        const sessionLimit = 10*60*1000;
        if(!user) return 1;
        if(!user.session) return 2;
        if(!user.session.timestamp || !user.session.hash) return 2;
        if(user.session.hash !== hash) return 3;
        if(Date.now() - user.session.timestamp > sessionLimit) return 4;
        return 0;
    }

    static blankPass() {
        return Util.addSalt(sha256(""));
    }

    static addSalt(password) {
        var toHash = `HaKuNa_MaTaTa${ password }WhAt-A-WoNdErFuL-PhRaSe! \\o/`;
        return sha256(toHash).toString();
    }

}