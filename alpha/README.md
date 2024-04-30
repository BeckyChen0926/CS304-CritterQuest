# CS304_CritterQuest

Team members: Ada, Becky, Lauren, Kaitlyn

CritterQuest Alpha Version: 4/30/24

A site to foster a community around sharing and learning about animals. 
Users can see a timeline of others' posts and like and comment on others’ posts as well.

```
Register for your own account:
Sample Username: scott
Sample Password: scott
(Or any string you’d like)
```

Directions:
You can create a new account or log in with the sample username and password. We suggest that you create your own account.
Just type in the username and password and click either login or register. 
Clicking the reset button will clear the entered username and password. It will take a while to login, just wait.
After logging in or registering it will take you to your profile page with your information. 
You can edit the about me info by clicking the "Edit Profile" button. 
You can just type your new about me into the form, and clicking update will update your information and take you back to your profile page. You will also see the posts you have posted on the right side of your profile page.

The nav bar on top has a link to the timeline. Clicking it will take you to a timeline of all the posts in the database in reverse chronological order. You are able to click the like button to like the post. We plan to implement ajax for the like buttons in the future.
You are also able to click the comment button to go to the detail page of that one page. You can leave a comment by typing in the "Leave a comment!" box and click "send comment" to submit. The comment will show up at the bottom of that page. Now, click timeline in the nav bar to go back to the timeline.

The nav bar also has a link to Post a Sighting. Clicking this will take you to the post form where you select the type of animal you saw from a dropdown bar (or, if you want to most an animal that is not in the list, select “I will enter a new animal” and type your animal in the box to the right), type the location where you saw it, upload your image, and then write a caption for the post. 
Clicking the “Post my animal sighting!” button will redirect you to the timeline where your upload will appear.
Post two posts using the sample info below:
```
Sample Post Info:
Select: dog (leave the “add your own animal” box blank, unless you are adding a new animal that is not in the drop-down menu)
Location: Science Center
Image: [Any image of an animal, or you can save this linked image and post it](https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2F2.bp.blogspot.com%2F-mLeDysqYQuE%2FVmTKL9CqcTI%2FAAAAAAAD6jM%2FR_juYUEe_G4%2Fs1600%2FDogs%2B00182.jpg&f=1&nofb=1&ipt=b6c2c7dd037d5b34f5590690c967fcf76ced8078785a34df01198ce7000d1db6&ipo=images)
Caption: I just saw the cute dog outside of sci! Literally the best day ever!!

Sample Post 2 Info:
Type in "Add new animal": flamingo (leave the “Select Animal” drop-down untouched, unless you are selected an existing animal entry)
Location: Lake Waban
Image: [Any image of a flamingo, or you can save this linked image and post it](https://images.app.goo.gl/E1i7E3w7p2R1dDF69)
Caption: I saw a flamingo in the lake for the first time. Made my day!

```

There is also a search tab on the nav bar that will take you to a search form, where you can search by location or animals.
Search "dog" (exists) and "swan" (does not exist) and select By: "animal" to see the relevant posts. Search "lake" and select By: "location" to see all posts with location name that includes "lake."

Finally, the nav bar contains the Logout link which takes you back to the Login/Register page.
