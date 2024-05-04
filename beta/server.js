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
const ROUNDS = 14;
const counter = require('./counter-utils.js')


// our modules loaded from cwd

const { Connection } = require('./connection.js');
const cs304 = require('./cs304.js');
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
const { rmSync } = require('fs');


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
const ANIMALS = 'animals';


// Route to render the login page
// Users who are already logged in (this current session) will be redirected to the timeline page.
// Returns the rendered login page if the user is not logged in.
app.get('/', (req, res) => {
    if(req.session.loggedIn){
        return res.redirect("/timeline");
    }
    // Renders the login page when accessing the root URL
    return res.render('login.ejs');
});

// Route to handle user registration
// Processes the submitted registration form.
// If the username already exists, prompts the user to choose another username or login.
// Otherwise, inserts the new user into the users database and assigns them the welcome badge.
// NOTE FROM TEAM: Currently, the badges are being hardcoded where we assign the welcome badge to everyone. We will add user-obtainable badges later. 
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
        var newCount = await counter.incr(counters, USERS);
        // console.log(newCount);
        // var countObj = await counters.findOne({ collection: 'users' });
        console.log('new count: ' + newCount);
        // var uid = countObj["counter"];
        const uid = newCount;

        // Hash the password before storing it
        const hash = await bcrypt.hash(password, ROUNDS);

        // Insert the new user into the database
        await db.collection(USERS).insertOne({
            username: username,
            hash: hash,
            UID: uid,
            aboutme: "",
            badges: ['welcomeBadge.png'],
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
// Processes the submitted login form, comparing the provided password with the hashed password stored in the database.
// If successful, sets session variables and redirects to the profile page.
// If there are any issues, such as non-existent username or incorrect password, prompts the user accordingly.
// Returns a redirect to the profile page or the login page, depending on the outcome.
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
        req.session.uid = uid;
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


// Route to display the timeline page
// Fetches a list of all posts and renders the timeline page with user posts and user ID.
// Users must be logged in to access this page.
// Returns the rendered timeline page if the user is logged in.
app.get('/timeline/', async (req, res) => {
    //users can only do access this page if they are logged in, so we need to check for that uncomment when we have logins working
    if(!req.session.loggedIn){ 
        req.flash('error', "Please login first!");
        return res.redirect('/');
    }
    const db = await Connection.open(mongoUri, CRITTERQUEST);
    const postList = await db.collection(POSTS).find({}, { sort: { PID: -1,time:-1 } }).toArray();
    console.log(postList);

    return res.render('timeline.ejs', { userPosts: postList, uid: req.session.uid });
});

// Helper function to increment the likes on a post
// Takes the post id as an argument and increments the 'likes' field of the post in the database.
// Returns the updated number of likes.
async function incrementLikes(pid) {
    const db = await Connection.open(mongoUri, CRITTERQUEST);

    const postsCollection = db.collection(POSTS);

    // Update the 'likes' field of the post and return the updated document
    const updatedPost = await postsCollection.findOneAndUpdate(
        { PID: pid },
        { $inc: { likes: 1 } },
        { returnDocument: "after" }
    );

    // Return the updated number of likes
    return updatedPost.likes;
}

// Route to handle the like button click on a post
// Increments the likes for the post using pid and redirects to the timeline page.
// If there is an error, returns an internal server error status.
// Returns a redirect to the timeline page if successful.
// NOTE FROM TEAM: might try to update to ajax later.
app.post('/like', async (req, res) => {
    // const postId = req.body.postId;
    const pid = parseInt(req.body.postid);

    try {
        // Increment likes for the post
        const updatedLikes = await incrementLikes(pid);
        console.log(updatedLikes);
        return res.redirect('/timeline');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
    return res.redirect('/timeline');
});

// Route to render the logout page
// Displays the logout confirmation page.
app.get('/logout', (req,res)=>{
    return res.render('logout.ejs',{uid:req.session.uid});
});

// Route to handle user logout
// Clears session variables and redirects the user to the login page.
app.post('/logout', (req,res) => {
    if(!req.session.loggedIn){
        req.flash('error', 'You are not logged in - please do so.');
        return res.redirect("/");
    }
    if (req.session.username) {
      req.session.username = null;
      req.session.loggedIn = false;
      req.flash('info', 'You are logged out');
      return res.redirect('/');
    } else {
      req.flash('error', 'You are not logged in - please do so.');
      return res.redirect('/');
    }
  });

// Route to render the posting form
// Displays the animal sighting form with a dynamic list of animals for selection
// or the user can enter their own animal.
// Requires the user to be logged in to access this page.
// Returns the rendered posting form if the user is logged in.
app.get('/posting/', async (req, res) => {
    if(!req.session.loggedIn){
        req.flash('error', 'You are not logged in - please do so.');
        return res.redirect("/");
    }
    console.log('get form');
    const db = await Connection.open(mongoUri, CRITTERQUEST);
    // var existingUser = await db.collection(USERS).findOne({ username: req.session.username });
    // var uid = existingUser.UID;
    var animalList = await db.collection(ANIMALS).find({}).toArray();
    return res.render('form.ejs', { action: '/posting/', location: '', uid: req.session.uid,animalList });
});

// Route to handle posting an animal sighting
// Takes the form data, uploads a photo, and inserts a new post into the database.
// Redirects the user to the timeline page after successfully posting.
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

    const customAnimal = req.body.custom_animal.toLowerCase();
    if (customAnimal) {
        // Insert the custom animal into the database
        await db.collection(ANIMALS).insertOne({ 'animal': customAnimal });

        // Use the custom animal as the selected animal
        req.body.animal = customAnimal;
    }

    // let counters = db.collection(COUNTERS);
    // counter.incr(counters, "posts");
    // var countObj = await counters.findOne({ collection: 'posts' });
    // var PID = countObj["counter"];

    // Increment posts counter and get the PID
    let counters = db.collection(COUNTERS);
    var newCount = await counter.incr(counters, POSTS);
    // console.log(newCount);
    // var countObj = await counters.findOne({ collection: 'users' });
    console.log('new count: ' + newCount);
    // var uid = countObj["counter"];
    const PID = newCount;

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

// Route to render the user's own profile page
// Displays the user's profile with their posts, badges, and description.
// Requires the user to be logged in to access this page.
// Returns the rendered profile page if the user is logged in.
app.get('/profile/:userID', async (req, res) => {
    if(!req.session.loggedIn){
        req.flash('error', 'You are not logged in - please do so.');
        return res.redirect("/");
    }

    //check to see if this person exists
    const userID = parseInt(req.params.userID);
    const db = await Connection.open(mongoUri, CRITTERQUEST); //open the connection to the db critterquest
    const people = db.collection(USERS); //go to the Users collection
    let accessedUserObj = await people.findOne({ UID: userID });
    if(accessedUserObj == null){
        req.flash('error', "This user doesn't exist! ");
        return res.redirect("/timeline")
    }

    // const idString = req.params.userID;
    // const idNumber = parseInt(idString); //need to parse the string as an integer

    //check whether you are viewing your own profile or if you are looking at someone else's 
    var isOwnProfile;
    let currUser = req.session.uid;
    let accessUser = accessedUserObj.UID;
    if (currUser == accessUser){
        isOwnProfile = true;
    }
    else{
        isOwnProfile = false;
    }

    //get the user information stored in the DB
    // var person = await people.findOne({ UID: userID }); //find profile
    console.log(accessedUserObj);
    var allBadges = accessedUserObj.badges || null; //list of images, its just words for now 
    var personDescription = accessedUserObj.aboutme || null;
    var username = accessedUserObj.username;

    const posts = db.collection(POSTS); //go to the Users collection
    var myPosts = await posts.find({ UID: userID },{ sort: { PID: -1 } }).toArray();
    console.log(myPosts);

    return res.render('profile.ejs',
        {
            uid: userID,  
            UID: req.session.uid, //for nav bar profile access
            badges: allBadges,
            isOwnProfile: isOwnProfile,
            aboutme: personDescription,
            username: username,
            myPosts:myPosts
        });
});


// Route to render the edit profile form
// Displays the form with the user's current information pre-filled.
// Requires the user to be logged in to access this page.
// Returns the rendered edit profile form.
app.get("/edit/:userID", async (req, res) => {
    if(!req.session.loggedIn){
        req.flash('error', 'You are not logged in - please do so.');
        return res.redirect("/");
    }
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

// Route to handle updating the user's profile
// Updates the user's 'about me' information with the entered info
// in the database.
// Redirects the user to their updated profile page if successful.
app.post('/edit/:userID', async (req, res) => {
    const uid = parseInt(req.params.userID);
    const db = await Connection.open(mongoUri, CRITTERQUEST);
    const users = db.collection(USERS);
    const aboutme= req.body.aboutMe;

    // Fetch user details using uid
    const filter = {UID: uid};  // document to update
    const update = {$set: {aboutme: aboutme}};   // changes to make
    const options = {upsert: false}; //don't want to upsert
    await users.updateOne(filter, update, options);
    
    // Redirect to the profile page for the updated profile
    res.redirect(`/profile/${req.session.uid}`);
});

// Route to render the comment page with a form for a specific post
// Displays the specific post and form to add a comment to this specific post.
// Users must be logged in to access this page.
app.get('/comment/:PID', async (req,res)=>{
    if(!req.session.loggedIn){
        req.flash('error', 'You are not logged in - please do so.');
        return res.redirect("/");
    }
    const pid = parseInt(req.params.PID);

    const db = await Connection.open(mongoUri, CRITTERQUEST);
    const currPost = await db.collection(POSTS).findOne({PID:pid});
    console.log(currPost)
    res.render("comment.ejs", { uid: req.session.uid, post: currPost});

})

// Route to handle posting a comment on a specific post
// Adds a comment to the specified post in the database.
// Users must be logged in to access this feature.
// Returns the rendered post and comment page with the comment section.
app.post('/comment/:PID', async (req,res)=>{
    if(!req.session.loggedIn){
        req.flash('error', 'You are not logged in - please do so.');
        return res.redirect("/");
    }
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

// Route to render the search bar page
app.get('/filter', async (req, res) =>
    {
        return res.render('filter.ejs', {uid: req.session.uid});
    });

// Route to handle searching by animals or locations
// Allows users to search for animals or locations based on the provided query parameters.
// Renders posts based on search results, else return a page warning about no posts found
app.get('/search/', async(req,res) => {
    // Extract search term and kind from query parameters
    const term = req.query.term;
    const kind = req.query.kind;
    console.log(term,kind);

    // Open connection to the database
    const db = await Connection.open(mongoUri,  CRITTERQUEST);
    const posts = db.collection(POSTS);

    // Perform search based on the kind of search
    if (kind === "animal"){
        // Search for animals matching the term
        const result = await posts.find({ animal: new RegExp(term, 'i') }).sort({ PID: -1, time: -1 }).toArray();
        console.log("result",result);
       
        if (result.length === 0) {
            // If no results found, render 'none.ejs' template with appropriate message
            return res.render("none.ejs", { option: kind, uid: req.session.uid, term: term });
        } else {
            console.log(result);
            // Find posts related to the found animal
            const animalPosts = await posts.find({ animal: result[0].animal }).sort({ PID: -1, time: -1 }).toArray();
            // Render 'animal.ejs' template with information about the animal and related posts
            return res.render("animal.ejs", { option: kind, uid: req.session.uid, animal: result[0], animals: animalPosts, term: term });
        }
    } else if (kind === "location") {
        // Search for posts with the specified location
        const result = await posts.find({ location: new RegExp(term, 'i') }).sort({ PID: -1, time: -1 }).toArray();
        console.log("result",result);
        
        if (result.length === 0) {
            // If no results found, render 'none.ejs' template with appropriate message
            return res.render("none.ejs", { option: kind, uid: req.session.uid, term: term });
        } else {
            console.log(result);
            // Find posts related to the found location
            const locationPosts = await posts.find({ location: new RegExp(term, 'i') }).sort({ PID: -1, time: -1 }).toArray();
            // Render 'animal.ejs' template with information about the location and related posts
            return res.render("animal.ejs", { option: kind, uid: req.session.uid, animal: result[0], animals: locationPosts, term: term });
        }
    }
});



// ================================================================
// postlude

const serverPort = cs304.getPort(8080);

// this is last, because it never returns
app.listen(serverPort, function () {
    console.log(`open http://localhost:${serverPort}`);
});