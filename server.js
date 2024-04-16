// start app with 'npm run dev' in a terminal window
// go to http://localhost:port/ to view your deployment!
// every time you change something in server.js and save, your deployment will automatically reload

// to exit, type 'ctrl + c', then press the enter key in a terminal window
// if you're prompted with 'terminate batch job (y/n)?', type 'y', then press the enter key in the same terminal

// standard modules, loaded from node_modules
const path = require('path');
require("dotenv").config({ path: path.join(process.env.HOME, '.cs304env')});
const express = require('express');
const morgan = require('morgan');
const serveStatic = require('serve-static');
const bodyParser = require('body-parser');
const cookieSession = require('cookie-session');
const flash = require('express-flash');
const multer = require('multer');

// our modules loaded from cwd

const { Connection } = require('./connection');
const cs304 = require('./cs304');

// Create and configure the app

const app = express();

// Morgan reports the final status code of a request's response
app.use(morgan('tiny'));

app.use(cs304.logStartRequest);

// This handles POST data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cs304.logRequestData);  // tell the user about any request data
app.use(flash());


app.use(serveStatic('public'));
app.set('view engine', 'ejs');

const mongoUri = cs304.getMongoUri();

app.use(cookieSession({
    name: 'session',
    keys: ['horsebattery'],

    // Cookie Options
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));

function timeString(dateObj) {
    if (!dateObj) {
        dateObj = new Date();
    }
    // convert val to two-digit string
    d2 = (val) => val < 10 ? '0' + val : '' + val;
    let hh = d2(dateObj.getHours())
    let mm = d2(dateObj.getMinutes())
    let ss = d2(dateObj.getSeconds())
    return hh + mm + ss
}

app.use('/uploads', express.static('uploads'));
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads')
    },
    filename: function (req, file, cb) {
        let parts = file.originalname.split('.');
        let ext = parts[parts.length - 1];
        let hhmmss = timeString();
        cb(null, file.fieldname + '-' + hhmmss + '.' + ext);
    }
})
var upload = multer({
    storage: storage,
    // max fileSize in bytes, causes an ugly error
    limits: { fileSize: 1_000 }
});

app.use((err, req, res, next) => {
    console.log('error', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
        console.log('file too big')
        req.flash('error', 'file too big')
        res.redirect('/')
    } else {
        console.error(err.stack)
        res.status(500).send('Something broke!')
    }
})

// ================================================================
// custom routes here

const DB = process.env.USER;

// Use these constants and mispellings become errors
const CRITTERQUEST = "critterquest";
const POSTS = "posts";
const USERS = "users"
// const UPLOADS = 'uploads';

app.get('/', (req, res) => {
    let uid = req.session.uid || 'unknown';
    // console.log('uid', uid);
    // return res.render('index.ejs', {uid});
    return res.render('login.ejs', {uid});
});

// main page. This shows the use of session cookies
app.get('/timeline/', async (req, res) => {
    const db = await Connection.open(mongoUri, CRITTERQUEST);
    const postList = await db.collection(POSTS).find({}, { sort: { PID: -1 }}).toArray();
    return res.render('timeline.ejs', {userPosts: postList});
});

// shows how logins might work by setting a value in the session
// This is a conventional, non-Ajax, login, so it redirects to main page 
app.post('/set-uid/', (req, res) => {
    console.log('in set-uid');
    req.session.uid = req.body.uid;
    req.session.logged_in = true;
    res.redirect('/');
});

// shows how logins might work via Ajax
app.post('/set-uid-ajax/', (req, res) => {
    console.log(Object.keys(req.body));
    console.log(req.body);
    let uid = req.body.uid;
    if(!uid) {
        res.send({error: 'no uid'}, 400);
        return;
    }
    req.session.uid = req.body.uid;
    req.session.logged_in = true;
    console.log('logged in via ajax as ', req.body.uid);
    res.send({error: false});
});

// conventional non-Ajax logout, so redirects
app.post('/logout/', (req, res) => {
    console.log('in logout');
    req.session.uid = false;
    req.session.logged_in = false;
    res.redirect('/login');
});

// conventional non-Ajax logout, so redirects
app.get('/logout/', (req, res) => {
    res.render("logout.ejs");
});

// two kinds of forms (GET and POST), both of which are pre-filled with data
// from previous request, including a SELECT menu. Everything but radio buttons

app.get('/posting/', async (req, res) => {
    console.log('get form');
    return res.render('form.ejs', {action: '/posting/', location:''});
});

// limited but not private
app.post('/posting/', upload.single('photo'), async (req, res) => {
    console.log('uploaded data', req.body);
    console.log('file', req.file);
    console.log('post form');
    const username = req.session.user;
    // if (!username) {
    //     req.flash('info', "You are not logged in");
    //     return res.redirect('/login');
    // }
    // if (!req.file) {
    //     req.flash('error', "No file uploaded");
    //     return res.redirect('/posting/');
    // }

    const db = await Connection.open(mongoUri, DB);
    const result = await db.collection(POSTS)
        .insertOne({
            PID: 3,
            UID: req.session.UID,
            user: username,
            time: new Date(),
            // path: '/uploads/' + 'whatever',
            path: '/uploads/' + 'req.file.filename',

            animal: req.body.animal.value,
            location: req.body.location,
            caption: req.body.caption
        });
    console.log('insertOne result', result);
    req.flash('info','file uploaded');
    return res.redirect('/timeline/');
});

app.get('/profile/:userID', async (req, res) => {
    const db = await Connection.open(mongoUri, CRITTERQUEST); //open the connection to the db critterquest
    const people = db.collection(USERS); //go to the Users collection
    const idString = req.params.userID;
    const idNumber = parseInt(idString); //need to parse the string as an integer

    //check whether you are viewing your own profile or if you are looking at someone else's 
    var isOwnProfile = true; //hardcode to yes for now, login stuff hasn't been implemented yet so we don't have user sessions

    //get the user information stored in the DB
    var person = await people.findOne({ UID: idNumber}); //find profile
    var allBadges = person.badges; //list of images, its just words for now 
    var personDescription = person.aboutme;
    var pfp = person.pfp;
    var username = person.username;

    //get all the posts which are tagged with the userID 
    const posts = db.collection(POSTS); //go to the Users collection
    var allPosts = await posts.find({UID: idNumber});

    return res.render('profile.ejs', 
                            {
                                posts: allPosts, 
                                badges: allBadges,
                                isOwnProfile: isOwnProfile,
                                aboutme: personDescription,
                                username: username,
                                pfp: pfp
                             });
});

app.get('/staffList/', async (req, res) => {
    const db = await Connection.open(mongoUri, WMDB);
    let all = await db.collection(STAFF).find({}).sort({name: 1}).toArray();
    console.log('len', all.length, 'first', all[0]);
    return res.render('list.ejs', {listDescription: 'all staff', list: all});
});

// ================================================================
// postlude

const serverPort = cs304.getPort(8080);

// this is last, because it never returns
app.listen(serverPort, function() {
    console.log(`open http://localhost:${serverPort}`);
});
