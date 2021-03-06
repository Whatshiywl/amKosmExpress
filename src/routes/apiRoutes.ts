var express = require('express');
var Router = express.Router;
import DBManager from './../DBManager';

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
                p: '/orderList', h: this.getOrderList.bind(this), v: true
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
                p: '/user-list', h: this.getUserList.bind(this), v: true
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

    validate(req, res, next) {
        var cpf = req.query.cpf || req.body.cpf;
        cpf = cpf ? cpf.toString().replace(/[^\d]+/g,'') : "";
        var session = req.query.session || req.body.session;
        var err = DBManager.validate(cpf, session);
        if(err) {
            res.status(200).json({success: false, err: err, logged: false});
        } else {
            if(next && typeof next == "function") next(req, res);
        }
    }

    getOrder(req, res) {
        var id = req.query["id"];
        var order = DBManager.getOrder(id);
        res.json({order: order, logged: true});
    }

    postOrder(req, res, logged) {
        var cpf = req.body["cpf"];
        cpf = cpf ? cpf.toString().replace(/[^\d]+/g,'') : "";
        var products = req.body["products"];
        var address = req.body.address
        DBManager.postOrder(cpf, products, address, (err, id) => {
            res.status(200).json({success: !err, err: err, id: id, logged: true});
        });
    }

    getOrderList(req, res) {
        var orders = DBManager.getOrderList();
        res.json({orders: orders, logged: true});
    }

    getUser(req, res) {
        var cpf = req.query["cpf"];
        cpf = cpf ? cpf.toString().replace(/[^\d]+/g,'') : "";
        var user = DBManager.getUser(cpf);
        res.json({user: user, logged: true});
    }

    getUserExists(req, res) {
        var cpf = req.query["cpf"];
        cpf = cpf ? cpf.toString().replace(/[^\d]+/g,'') : "";
        res.status(200).json({exists: DBManager.getUserExists(cpf)});
    }

    postUser(req, res) {
        var name = req.body["name"];
        var cpf = req.body["cpf"];
        var email = req.body["email"];
        cpf = cpf ? cpf.toString().replace(/[^\d]+/g,'') : "";
        var pass = req.body["password"] || "";
        DBManager.postUser(name, cpf, pass, email, err => {
            res.status(200).json({success: !err, err: err, cpf: cpf, email: email});
        });
    }

    postResubmitConfirmSignUp(req, res) {
        let cpf = req.body.cpf;
        cpf = cpf ? cpf.toString().replace(/[^\d]+/g,'') : "";
        DBManager.resubmitConfirmSignUp(cpf, err => {
            res.status(200).json({success: !err, err: err});
        });
    }

    getUserList(req, res) {
        var users = DBManager.getUserList();
        res.json({users: users, logged: true});
    }

    getAddress(req, res) {
        var cpf = req.query.cpf;
        DBManager.getAddressByCpf(cpf, (err, address) => {
            res.status(200).json({success: !err, err: err, address: address, logged: true});
        });
    }

    postAddress(req, res) {
        var cpf = req.body.cpf;
        cpf = cpf ? cpf.toString().replace(/[^\d]+/g,'') : "";
        var address = req.body.address;
        DBManager.postAddress(cpf, address, err => {
            res.status(200).json({success: !err, err: err, logged: true});
        });
    }

    postChangePassword(req, res) {
        var cpf = req.body["cpf"];
        cpf = cpf ? cpf.toString().replace(/[^\d]+/g,'') : "";
        var oldPass = req.body["oldPass"] || "";
        var newPass = req.body["newPass"] || "";
        DBManager.postChangePassword(cpf, oldPass, newPass, err => {
            res.status(200).json({success: !err, err: err});
        });
    }

    postLogin(req, res) {
        console.log("body", req.body);
        var cpf = req.body["cpf"];
        cpf = cpf ? cpf.toString().replace(/[^\d]+/g,'') : "";
        var pass = req.body["password"] || "";
        DBManager.postLogin(cpf, pass, (err, session) => {
            res.status(200).json({success: !err, err: err, cpf: cpf, session: session});
        });
    }

    getSession(req, res) {
        this.validate(req, res, (req, res) => {
            res.status(200).json({success: true});
        });
    }

}

export default (new ApiRoutes()).router;