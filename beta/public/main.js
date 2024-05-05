"use strict";

var g;

function nextIfOk(resp) {
    g = resp;
    console.log('response received');
    if(resp.status === 200) {
        return resp.json();
    } else {
        throw new Error('Something went wrong on server!');
    }
}

function loginAjax() {
    let uid = $('[name=uid]').val();
    let form = document.getElementById('login_form');
    console.log('form', form);
    let form_data = new FormData(form);
    console.log('data', form_data);
    const req = new Request('/set-uid-ajax/', {method: 'POST',
                                               body: form_data});
    fetch(req)
        .then(nextIfOk)
        .then((resp) => { console.debug(resp);
                          // update page for logged-in user
                          $("#login-uid").text(uid);
                          $("#logged-in").show();
                          $("#not-logged-in").hide();
                        })
        .catch((error) => { console.error(error); });
}

$("#login-ajax").click(loginAjax);

/*
function processAction(resp) {
    console.log('response is ',resp);
    if (resp.error) {
        alert('Error: '+resp.error);
    }
    console.log("Liked post "+resp.PID+". Total likes: "+resp.likes);
    $(`[data-pid=${resp.PID}]`).find('.likes').text(resp.likes);
}

function likePost(PID) {
    // $.ajax("/likeAjax/"+tt, {method: 'POST', data: {tt: tt}, success: processAction});
    $.post("/likeAjax/"+PID, {PID: PID}).then(processAction);
}

$(".likeComment").on('click', '.likeButton', function (event) {
    //if(!progressive_on) return;
    var PID = $(this).closest("[data-pid]").attr('data-pid');
    likePost(PID);
  });
*/

console.log('main.js loaded');

