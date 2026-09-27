const API_URL = "http://127.0.0.1:8000/";

function checkName(){
    if (localStorage.getItem("username")){
        document.getElementById("nameForm").classList.add("hidden");
        document.getElementById("main2").classList.remove("hidden");
    }
}

function confirmUsername(){
    let name = document.getElementById("nameInput").value.trim();
    if (name.length < 3) {
        document.getElementById("msg").innerHTML = "Name must be atleast 3 characters long";
        return;
    }
    
    if (name.length > 20) {
        document.getElementById("msg").innerHTML = "Name must be atmost 20 character long";
        return;
    }

    localStorage.setItem("username", name);
    checkName();
}

async function getNotes(){
    try {
        let request = await fetch(API_URL+"notes/");

        let data = await request.json();

        return data;
    }
    catch(e){
        console.log(e);
    }
}

async function showNotes(){
    let notes = await getNotes();

    if (notes.length == 0){
        document.getElementById("notesContainer").innerHTML = `
            Nobody noted anything yet :(
        `;
        document.getElementById("notesContainer").classList.add("noNotes")
        return;
    }

    for (let note of notes.reverse()){
        noteDiv = document.createElement("div");
        noteDiv.classList.add("noteCard");
        noteDiv.innerHTML = `
            <div class="topContainer">
                <h3 class="noteUsername">${note.username}</h3>
                <p class="noteDate">${note.date}</p>
            </div>
            <p class="noteText">${note.note}</p>
        `;

        document.getElementById("notesContainer").appendChild(noteDiv);
    }
}

async function addNote(){
    try {
        let request = await fetch(API_URL+"add_note/",{
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: localStorage.getItem("username"),
                note: document.getElementById("noteInput").value
            })
        });
    }
    catch(e){
        console.log(e);
    }
}

document.addEventListener("DOMContentLoaded",async function (e){
    await checkName();
    await showNotes();
})

document.getElementById("noteItBtn").addEventListener("click", function (e){
    e.preventDefault();
    addNote();
    showNotes();
})
