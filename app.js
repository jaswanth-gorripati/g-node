const fabricclient = require('fabric-client')
var fs = require("fs")
const express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');
var chokidar = require('chokidar');
var pth = require('path')
var exec = require('child_process').exec;
const { SHA3 } = require('sha3');
const fileUpload = require('express-fileupload');
var expressJWT = require('express-jwt');
var jwt = require('jsonwebtoken');
var bearerToken = require('express-bearer-token');
const enrollModule = require('./enrollment.js')
var transaction = require('./transactions.js')
const queries = require('./query.js')

const defaultsPath = path.resolve(__dirname, 'defaults.json');
const defaultsJSON = fs.readFileSync(defaultsPath, 'utf8');
const defaults = JSON.parse(defaultsJSON);
let port = defaults["Port"] || 4001
const PostUrls = [];
const QueryUrls = [];

/* 
 * Middleware
 */

let app = express();
app.use(fileUpload());
app.options('*', cors());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));
app.listen(port, function(err) {
    if (err) {
        console.log("Cannot start the sever ")
    }
})
app.set('secret', 'newSecret');
app.use(expressJWT({
    secret: 'newSecret'
}).unless({
    path: ['/login', /^\/getMshFile\/.*/]
}));
app.use(bearerToken());
app.use(function(req, res, next) {
    console.info(' ------>>>>>> new request for %s', req.originalUrl);
    if (req.originalUrl.indexOf('/login') >= 0) {
        return next();
    } else if (req.originalUrl.indexOf(/^\/getMshFile\/.*/) >= 0) {
        return next();
    }

    var token = req.token;
    jwt.verify(token, app.get('secret'), function(err, decoded) {
        if (err) {
            res.send({
                success: false,
                message: 'Failed to authenticate token. Make sure to include the ' +
                    'token returned from /users call in the authorization header ' +
                    ' as a Bearer token'
            });
            return;
        } else {
            req.username = decoded.username;
            req.exp = decoded.exp;
            console.info('Decoded from JWT token: username - %s, expiry - %s', decoded.username, decoded.exp);
            return next();
        }
    });
});

function getErrorMessage(field) {
    var response = {
        success: false,
        message: field + ' field is missing or Invalid in the request'
    };
    return response;
}

app.post('/login', async function(req, res) {
    var username = req.body.username;
    var password = req.body.password;
    console.info('End point : /login');
    console.info('User name : ' + username);
    console.info('Org name  : ' + password);
    if (!username) {
        res.json(getErrorMessage('\'username\''));
        return;
    }
    if (!password) {
        res.json(getErrorMessage('\'password\''));
        return;
    }
    var token = jwt.sign({
        exp: Math.floor(Date.now() / 1000) + parseInt(3600),
        username: username
    }, app.get('secret'));

    let isEnrolled = await enrollModule.enrollment(username, password)
    if (isEnrolled.sucess) {
        console.log(username + " logged in")
        isEnrolled.token = token;
        res.status(200).send(isEnrolled)
    } else {
        console.log("user failed to login , register org admin")
        res.status(500).send(isEnrolled)
    }
})

app.post('/logout', async function(req, res) {
    let result = await transaction.logOut(req.username)
    sendResponse(res, result)
})

async function sendResponse(res, result) {
    if (result.success) {
        res.status(200).send(result.message)
    } else {
        res.status(500).send(result.message)
    }
}

app.post("/api/:fcn", async function(req, res) {
    let fcn = req.params.fcn
    let _args = req.body.args;
    let args = ""
    if (_args == "" || _args == undefined) {
        res.json(getErrorMessage('\'args in body \''));
        return;
    }
    if (typeof(_args) == typeof([])) {
        args = JSON.stringify(_args)
    }
    let result = await transaction.submitInvoke(req.username, fcn, args)
    sendResponse(res, result)
})

app.get("/api/:fcn", async function(req, res) {
    let fcn = req.params.fcn
    let _args = req.body.args | "";
    let args = ""
    if (_args == undefined) {
        res.json(getErrorMessage('\'args in body \''));
        return;
    }
    if (typeof(_args) == typeof([])) {
        args = JSON.stringify(_args)
    }
    let result = await queries.query(req.username, fcn, args)
    sendResponse(res, result)
})