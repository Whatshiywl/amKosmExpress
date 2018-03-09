var express = require('express');
var Router = express.Router;
import * as DBManager from './../DBManager';

var _ = require('lodash');

export class ApiRoutes {

    router;

    constructor() {
        this.router = Router();
        const routes = this.setUpRoutes();
        this.init(routes);
    }

    setUpRoutes() {
        const routes = [
            {
                p: '/status', h: this.status.bind(this)
            },
            {
                p: '/order', h: this.getOrder.bind(this), v: true
            },
            {
                p: '/order', h: this.postOrder.bind(this), m: 'POST', v: true
            },
            {
                p: '/user', h: this.getUser.bind(this), v: true
            },
            {
                p: '/user-exists', h: this.getUserExists.bind(this)
            },
            {
                p: '/user', h: this.postUser.bind(this), m: 'POST'
            },
            {
                p: '/sign-up-resubmit', h: this.postResubmitConfirmSignUp.bind(this), m: 'POST'
            },
            {
                p: '/address', h: this.getAddress.bind(this), v: true
            },
            {
                p: '/address', h: this.postAddress.bind(this), m: 'POST', v: true
            },
            {
                p: '/change-password', h: this.postChangePassword.bind(this), m: 'POST'
            },
            {
                p: '/login', h: this.postLogin.bind(this), m: 'POST'
            },
            {
                p: '/session', h: this.getSession.bind(this)
            },
        ];
        return routes;
    }

    init(routes) {
        _.forEach(routes, route => {
            var method = (this.router[_.toLower(route.m || "GET")] || this.router.get).bind(this.router);
            var h = route.h;
            if(route.v) h = (req, res) => {
                this.validate(req, res, route.h);
            };
            method(route.p, h);
        });
    }

    status(req, res) {
        res.json({status: 'ok'});
    };

    validate(req, res, next: Function) {
        var cpf = req.query.cpf || req.body.cpf;
        cpf = cpf ? cpf.toString().replace(/[^\d]+/g,'') : "";
        var session = req.query.session || req.body.session;
        DBManager.dataIO.validate(cpf, session, err => {
            if(err) {
                res.status(200).json({success: false, err: err, logged: false});
            } else {
                next(req, res);
            }
        });
    }

    getOrder(req, res) {
        var id = req.query["id"];
        // var order = DBManager.jsonIO.getOrder(id);
        res.json({order: null, logged: true});
    }

    postOrder(req, res, logged) {
        var cpf = req.body["cpf"];
        cpf = cpf ? cpf.toString().replace(/[^\d]+/g,'') : "";
        var products = req.body["products"];
        var address = req.body.address
        DBManager.dataIO.postOrder(cpf, products, address, (err, id) => {
            res.status(200).json({success: !err, err: err, id: id, logged: true});
        });
    }

    getUser(req, res) {
        var cpf = req.query["cpf"];
        cpf = cpf ? cpf.toString().replace(/[^\d]+/g,'') : "";
        // var user = DBManager.jsonIO.getUser(cpf);
        res.json({user: null, logged: true});
    }

    getUserExists(req, res) {
        var cpf = req.query["cpf"];
        cpf = cpf ? cpf.toString().replace(/[^\d]+/g,'') : "";
        DBManager.dataIO.getUserExists(cpf, (err, data) => {
            res.status(200).json({success: !err, err: err, exists: data.exists, registered: data.registered});
        });
    }

    postUser(req, res) {
        var name = req.body["name"];
        var cpf = req.body["cpf"];
        var email = req.body["email"];
        cpf = cpf ? cpf.toString().replace(/[^\d]+/g,'') : "";
        var pass = req.body["password"] || "";
        DBManager.dataIO.postUser(name, cpf, pass, email, err => {
            res.status(200).json({success: !err, err: err, cpf: cpf, email: email});
        });
    }

    postResubmitConfirmSignUp(req, res) {
        let cpf = req.body.cpf;
        cpf = cpf ? cpf.toString().replace(/[^\d]+/g,'') : "";
        DBManager.dataIO.resubmitConfirmSignUp(cpf, err => {
            res.status(200).json({success: !err, err: err});
        });
    }

    getAddress(req, res) {
        var cpf = req.query.cpf;
        DBManager.jsonIO.getAddressByCpf(cpf, (err, address) => {
            res.status(200).json({success: !err, err: err, address: address, logged: true});
        });
    }

    postAddress(req, res) {
        var cpf = req.body.cpf;
        cpf = cpf ? cpf.toString().replace(/[^\d]+/g,'') : "";
        var address = req.body.address;
        DBManager.dataIO.postAddress(cpf, address, err => {
            res.status(200).json({success: !err, err: err, logged: true});
        });
    }

    postChangePassword(req, res) {
        var cpf = req.body["cpf"];
        cpf = cpf ? cpf.toString().replace(/[^\d]+/g,'') : "";
        var oldPass = req.body["oldPass"] || "";
        var newPass = req.body["newPass"] || "";
        DBManager.dataIO.postChangePassword(cpf, oldPass, newPass, err => {
            res.status(200).json({success: !err, err: err});
        });
    }

    postLogin(req, res) {
        var cpf = req.body["cpf"];
        cpf = cpf ? cpf.toString().replace(/[^\d]+/g,'') : "";
        var pass = req.body["password"] || "";
        DBManager.dataIO.postLogin(cpf, pass, (err, data) => {
            res.status(200).json({success: !err, err: err, cpf: cpf, session: data.hash, user: data.user});
        });
    }

    getSession(req, res) {
        this.validate(req, res, (req, res) => {
            res.status(200).json({success: true});
        });
    }

}

export default (new ApiRoutes()).router;