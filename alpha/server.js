// start app with 'npm run dev' in a terminal window
// go to http://localhost:port/ to view your deployment!
// every time you change something in server.js and save, your deployment will automatically reload

// to exit, type 'ctrl + c', then press the enter key in a terminal window
// if you're prompted with 'terminate batch job (y/n)?', type 'y', then press the enter key in the same terminal

// standard modules, loaded from node_modules
const path = require('path');
require("dotenv").config({ path: path.join(process.env.HOME, '.cs304env') });
const express = require('express');
const morgan = require('morgan');
const serveStatic = require('serve-static');
const bodyParser = require('body-parser');
const cookieSession = require('cookie-session');
const flash = require('express-flash');
const multer = require('multer');
const bcrypt = require('bcrypt');
const ROUNDS = 19;
const counter = require('./counter-utils.js')


// our modules loaded from cwd

const { Connection } = require('./connection');
const cs304 = require('./cs304');
const { time } = require('console');

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

const fs = require('node:fs/promises');

// app.use('/uploads', express.static('uploads'));
// var storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         cb(null, 'uploads')
//     },
app.use('/uploads', express.static('/students/critterquest/uploads'));
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, '/students/critterquest/uploads')
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
    limits: { fileSize: 1_000_000 }
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
const USERS = "users";
const COUNTERS = "counters";
// const UPLOADS = 'uploads';
const ANIMALS = 'animals';

// Route to render the login page
app.get('/', (req, res) => {
    // Renders the login page when accessing the root URL
    return res.render('login.ejs');
});

// Route to handle user registration
app.post("/join", async (req, res) => {
    try {
        const username = req.body.username;
        const password = req.body.password;
        const db = await Connection.open(mongoUri, CRITTERQUEST);

        // Check if the username already exists
        var existingUser = await db.collection(USERS).findOne({ username: username });
        if (existingUser) {
            // If the username already exists, redirect with an error message
            req.flash('error', "Login already exists - please try logging in instead.");
            return res.redirect('/')
        }

        // Increment user counter and get the UID
        let counters = db.collection(COUNTERS);
        counter.incr(counters, "users");
        var countObj = await counters.findOne({ collection: 'users' });
        var uid = countObj["counter"];

        // Hash the password before storing it
        const hash = await bcrypt.hash(password, ROUNDS);

        // Insert the new user into the database
        await db.collection(USERS).insertOne({
            username: username,
            hash: hash,
            UID: uid,
            aboutme: "",
            badges: ['Welcome!'],
        });

        // Log successful registration
        console.log('successfully joined', username, password, hash);

        // Flash success message and set session variables
        req.flash('info', 'successfully joined and logged in as ' + username);
        req.session.username = username;
        req.session.uid = uid;
        req.session.loggedIn = true;

        // Redirect to user profile page
        return res.redirect('/profile/' + uid);
    } catch (error) {
        // If there's an error, redirect with an error message
        req.flash('error', `Register error}`);
        return res.redirect('/')
    }
});

// Route to handle user login
app.post("/login", async (req, res) => {
    try {
        const username = req.body.username;
        const password = req.body.password;
        const db = await Connection.open(mongoUri, CRITTERQUEST);

        // Find the user in the database
        var existingUser = await db.collection(USERS).findOne({ username: username });
        var uid = existingUser.UID;

        // Log user information (for debugging purposes)
        console.log('user', new Date() + existingUser);

        if (!existingUser) {
            // If user does not exist, redirect with an error message
            req.flash('error', "Username does not exist - try again.");
            return res.redirect('/')
        }

        // Compare the provided password with the hashed password
        // Note: Bcrypt can take some time to process, especially during login attempts
        const match = await bcrypt.compare(password, existingUser.hash);

        // Log the result of password comparison
        console.log('match', new Date() + match);

        if (!match) {
            // If passwords don't match, redirect with an error message
            req.flash('error', "Username or password incorrect - try again.");
            return res.redirect('/')
        }

        // Set session variables for logged-in user
        req.session.username = username;
        req.session.loggedIn = true;

        // Log successful login
        console.log('login as', new Date() + username);

        // Redirect to user profile page
        return res.redirect('/profile/' + uid);
    } catch (error) {
        // If there's an error, redirect with an error message
        req.flash('error', "Username or password incorrect - try again.");
        return res.redirect('/')
    }
});


// main page. This shows the use of session cookies
app.get('/timeline/', async (req, res) => {
    //users can only do access this page if they are logged in, so we need to check for that uncomment when we have logins working
    if(!req.session.logged_in){ 
        req.flash('error', "Please login first!");
        return res.redirect('/');
    }
    const db = await Connection.open(mongoUri, CRITTERQUEST);
    const postList = await db.collection(POSTS).find({}, { sort: { PID: -1 } }).toArray();
    console.log(postList);

    // var existingUser = await db.collection(USERS).findOne({ username: req.session.username });
    // var uid = req.;

    //users can only do access this page if they are logged in, so we need to check for that uncomment when we have logins working
    /*
    if(!req.session.logged_in){ 
        return res.render('login.ejs');
    }
    */
    return res.render('timeline.ejs', { userPosts: postList, uid: req.session.uid });
});

async function incrementLikes(time) {
    const db = await Connection.open(mongoUri, CRITTERQUEST);

    const postsCollection = db.collection(POSTS);

    // Update the 'likes' field of the post and return the updated document
    const updatedPost = await postsCollection.findOneAndUpdate(
        { time: time },
        { $inc: { likes: 1 } },
        { returnDocument: "after" }
    );

    // Return the updated number of likes
    return updatedPost.likes;
}

// Handle the like button click
app.post('/like', async (req, res) => {
    // const postId = req.body.postId;
    const postDate = req.body.postTime;

    try {
        // Increment likes for the post
        const updatedLikes = await incrementLikes(postDate);
        console.log(updatedLikes);
        return res.redirect('/timeline');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
    return res.redirect('/timeline');
});

app.get('/logout', (req,res)=>{
    return res.render('logout.ejs');
});
app.post('/logout', (req,res) => {
    console.log("!!!!!!!!!! YOUR USERNAME BELOW !!!!!!!!!!!");
    console.log(req.session.username);
    if (req.session.username) {
      req.session.username = null;
      req.session.logged_in = false;
      req.flash('info', 'You are logged out');
      return res.redirect('/');
    } else {
      req.flash('error', 'You are not logged in - please do so.');
      return res.redirect('/');
    }
  });

// two kinds of forms (GET and POST), both of which are pre-filled with data
// from previous request, including a SELECT menu. Everything but radio buttons
// renders the post an animal sighting form with dynamic list of animals
app.get('/posting/', async (req, res) => {
    console.log('get form');
    const db = await Connection.open(mongoUri, CRITTERQUEST);
    var existingUser = await db.collection(USERS).findOne({ username: req.session.username });
    var uid = existingUser.UID;
    var animalList = await db.collection(ANIMALS).find({}).toArray();
    return res.render('form.ejs', { action: '/posting/', location: '', uid: uid,animalList });
});

// limited but not private
// Post an animal sighting using the posting form.
app.post('/posting/', upload.single('photo'), async (req, res) => {
    console.log('uploaded data', req.body);
    console.log('file', req.file);
    console.log('post form');
    // const username = req.session.username;
    var postTime = new Date();
    console.log('post time: ', postTime);
    // if (!username) {
    //     req.flash('info', "You are not logged in");
    //     return res.redirect('/login');
    // }
    // if (!req.file) {
    //     req.flash('error', "No file uploaded");
    //     return res.redirect('/posting/');
    // }

    // change the permissions of the file to be world-readable
    // this can be a relative or absolute pathname. 
    // Here, I used a relative pathname
    let val = await fs.chmod('/students/critterquest/uploads/'
        + req.file.filename, 0o664);
    console.log('chmod val', val);

    const db = await Connection.open(mongoUri, CRITTERQUEST);
    // var existingUser = await db.collection(USERS).findOne({ username: username });
    // var uid = req.session.UID;
    // console.log('user', existingUser);
    const customAnimal = req.body.custom_animal;
    if (customAnimal) {
        // Insert the custom animal into the database
        await db.collection(ANIMALS).insertOne({ 'animal': customAnimal });

        // Use the custom animal as the selected animal
        req.body.animal = customAnimal;
    }
    let counters = db.collection(COUNTERS);
    counter.incr(counters, "posts");
    var countObj = await counters.findOne({ collection: 'posts' });
    var PID = countObj["counter"];
    console.log(req.session);
    console.log('YOUR POST ID IS ' , PID);
    const result = await db.collection(POSTS)
        .insertOne({
            PID: PID,
            UID: req.session.uid,
            user: req.session.username,
            time: postTime.toLocaleString(),
            path: '/uploads/' + req.file.filename,
            animal: req.body.animal,
            location: req.body.location,
            caption: req.body.caption,
            likes: 0,
            comments: []
        });
    console.log('insertOne result', result);

    // req.flash('info','file uploaded');
    res.redirect('/timeline');
});

// shows your own profile page
app.get('/profile/:userID', async (req, res) => {
    let pageID = req.params.userID;
    let pageIDNum = parseInt(pageID);
    const db = await Connection.open(mongoUri, CRITTERQUEST); //open the connection to the db critterquest
    const people = db.collection(USERS); //go to the Users collection
    console.log("people: ", people)
    const idString = req.params.userID;
    console.log("idString: ", idString);
    const idNumber = parseInt(idString); //need to parse the string as an integer
    console.log("idNumber: ", idNumber);

    //check whether you are viewing your own profile or if you are looking at someone else's 
    var isOwnProfile;
    let currUser = req.session.username;
    let accessedUserObj = await people.findOne({UID: pageIDNum});
    let accessUser = accessedUserObj.username;
    if (currUser == accessUser){
        isOwnProfile = true;
    }
    else{
        isOwnProfile = false;
    }

    //get the user information stored in the DB
    var person = await people.findOne({ UID: idNumber }); //find profile
    console.log(person);
    var allBadges = person.badges || null; //list of images, its just words for now 
    var personDescription = person.aboutme || null;
    // var profilePic = person.pfp;
    var username = person.username;

    var myPosts = await db.collection(POSTS).find({ UID: idNumber },{ sort: { time: -1 } }).toArray();
    console.log(myPosts);

    //get all the posts which are tagged with the userID 
    const posts = db.collection(POSTS); //go to the Users collection
    var allPosts = await posts.find({ UID: idNumber });

    return res.render('profile.ejs',
        {
            uid: idNumber,
            posts: allPosts,
            badges: allBadges,
            isOwnProfile: isOwnProfile,
            aboutme: personDescription,
            username: username,
            // pfp: profilePic
            myPosts:myPosts
        });
});


/**
 * Render the edit form
 */
app.get("/edit/:userID", async (req, res) => {
    const uid = parseInt(req.params.userID);
    console.log("uid", uid);
    const db = await Connection.open(mongoUri, CRITTERQUEST);
    const users = db.collection(USERS);
    // console.log("users", users);

    // Fetch users details using uid
    const user = await users.findOne({ UID: uid });

    console.log("user", user);

    let username = user.username;

    let aboutMe = "Empty";

    if (user.aboutme != null) {
        aboutMe = user.aboutme;
    }

    res.render("editProfile.ejs", { user, username, aboutMe, uid: uid });
});

// update your own user about me
app.post('/edit/:userID', async (req, res) => {
    const uid = parseInt(req.params.userID);
    const db = await Connection.open(mongoUri, CRITTERQUEST);
    const users = db.collection(USERS);
    const { username, aboutMe } = req.body;

    // Fetch user details using uid
    const user = await users.findOne({ UID: uid });

    // Update user info.
    // user.username = username;
    user.aboutme = aboutMe;

    // Save the updated user
    const result = await users.updateOne({ UID: uid }, { $set: user });
    console.log(result);

    // Redirect to the profile page for the updated profile
    res.redirect(`/profile/${uid}`);
});

// need css + post a comment form
app.get('/comment/:PID', async (req,res)=>{
    // const caption = req.params.caption;
    const pid = parseInt(req.params.PID);
    // console.log(postId)
    // const postDate = req.body.postTime;
    const uid = parseInt(req.params.userID);
    // return res.redirect(`/comment/${uid}`);
    const db = await Connection.open(mongoUri, CRITTERQUEST);
    const currPost = await db.collection(POSTS).findOne({PID:pid});
    console.log(currPost)
    res.render("comment.ejs", { uid: uid, post: currPost});
    // return res.redirect('/comment',{uid:uid,post:currPost});

})

app.post('/comment/:PID', async (req,res)=>{
    // const caption = req.params.caption;
    const pid = parseInt(req.params.PID);
    // const uid = parseInt(req.params.userID);
    const comm = req.body.comment;
    const db = await Connection.open(mongoUri, CRITTERQUEST);
    const postTime = new Date()
    let currPost = await db.collection(POSTS)
                        .findOneAndUpdate(
                            { PID: pid },
                            { $push: { 'comments': {
                                'UID':req.session.uid,
                                'user': req.session.username,
                                'time': postTime.toLocaleString(),
                                'comment': comm
                            } } },
                            { returnDocument: "after" }
                        );
    console.log(currPost);
    currPost = await db.collection(POSTS).findOne({PID:pid});
    console.log(currPost);
    res.render("comment.ejs", { uid: req.session.uid, post: currPost});

})

// ================================================================
// postlude

const serverPort = cs304.getPort(8080);

// this is last, because it never returns
app.listen(serverPort, function () {
    console.log(`open http://localhost:${serverPort}`);
});