var _ = require('lodash');
var sha256 = require('crypto-js/sha256');

module.exports = class Address {
    line1;
    line2;
    neigh;
    city;
    state;
    code;
    
    constructor(line1, line2, neigh, city, state, code){
        this.line1 = line1;
        this.line2 = line2;
        this.neigh = neigh;
        this.city = city;
        this.state = state;
        this.code = code;
    }

    getHash() {
        var toHash = (this.line1 || "line1") +
                    (this.line2 || "line2") +
                    (this.neigh || "neigh") +
                    (this.city  || "city") +
                    (this.state || "state") +
                    (this.code  || "code");
        return sha256(toHash).toString();
    }
    
    getLine1() {
        return this.line1;
    }
    
    getLine2() {
        return this.line2;
    }

    getNeighborhood() {
        return this.neigh;
    }
    
    getCity() {
        return this.city;
    }
    
    getState() {
        return this.state;
    }
    
    getCode() {
        return this.code;
    }

    getCodeString() {
        var before = this.code.substr(0, 5);
        var after = this.code.subtr(5);
        return before + "-" + after;
    }

    toString() {
        return this.line1, this.line2, this.neigh, this.city + "/" + this.state, this.code;
    }
}