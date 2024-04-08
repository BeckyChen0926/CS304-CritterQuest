// const { Connection } = require("./connection");
// 

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

// our modules loaded from cwd

const { Connection } = require('../connection');
const cs304 = require('../cs304');

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



async function deleteAll(db) {
    const result = await db.collection('posts').deleteMany({});
    return result.acknowledged; //returns true if item successfully deleted
}

// just to insert a few users
async function insertPosts(db) {
    const result = await db.collection('posts')
        .insertMany([
            {
                // potentially short ID
                PID: 1,
                UID: 1,
                user: "Lily",
                time: new Date(),
                img: 'a picture of a cow',
                animal: 'cow',
                location: 'tower court',
                caption: 'I saw a cow in tower court today!',
                likes: 4,
                comments: [
                    {
                        UID: 2,
                        user: 'Harry',
                        comment: "You're kidding"
                    }
                ]
            }
        ]);
    return result.acknowledged; //returns true if item successfully inserted
}

async function main() {
    const posts = await Connection.open(mongoUri, 'critterquest');
    deleteAll(posts);
    let insert = await insertPosts(posts);
    console.log(insert);
}

main()