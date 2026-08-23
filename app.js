/* =========================================================
   QUICKPAY
   Firebase + QR Prototype
========================================================= */


/* =========================================================
   FIREBASE
========================================================= */

const firebaseConfig = {

    apiKey:
        "AIzaSyC9qC5SRO5hrHMRywxAiQQ--uYdIXL57fw",

    authDomain:
        "quickpay-63af0.firebaseapp.com",

    databaseURL:
        "https://quickpay-63af0-default-rtdb.firebaseio.com",

    projectId:
        "quickpay-63af0",

    storageBucket:
        "quickpay-63af0.firebasestorage.app",

    messagingSenderId:
        "972376102284",

    appId:
        "1:972376102284:web:8113f173fb85457ed332a9"
};


firebase.initializeApp(firebaseConfig);

const database =
    firebase.database();



/* =========================================================
   LOCAL STORAGE
========================================================= */

let accounts =
    JSON.parse(
        localStorage.getItem("quickpay_accounts") || "[]"
    );

let localTransactions =
    JSON.parse(
        localStorage.getItem("quickpay_transactions") || "[]"
    );


function saveAccounts() {

    localStorage.setItem(
        "quickpay_accounts",
        JSON.stringify(accounts)
    );
}


function saveLocalTransactions() {

    localStorage.setItem(
        "quickpay_transactions",
        JSON.stringify(localTransactions)
    );
}



/* =========================================================
   CURRENT STATE
========================================================= */

let currentReceiveTransactionId = null;

let currentReceiveRef = null;

let receiveListener = null;

let scanner = null;

let scannerRunning = false;

let scannedPayment = null;

let selectedAccountForDelete = null;

let transactionFilter = "all";



/* =========================================================
   NOTIFICATION SYSTEM
========================================================= */

function showToast(message, type) {

    type = type || "info";


    /* Remove existing toasts. */

    const oldToasts =
        document.querySelectorAll(".toast");


    oldToasts.forEach(toast => {

        toast.remove();

    });


    const toast =
        document.createElement("div");


    toast.className =
        "toast toast-" + type;


    toast.textContent =
        message;


    document.body.appendChild(toast);


    /* Auto-dismiss after 3 seconds. */

    setTimeout(() => {

        toast.style.opacity = "0";

        toast.style.transition = "opacity .3s";


        setTimeout(() => {

            toast.remove();

        }, 300);

    }, 3000);
}



/* =========================================================
   PAGE NAVIGATION
========================================================= */

function showPage(pageId) {

    document
        .querySelectorAll(".page")
        .forEach(page => {

            page.classList.remove("active");

        });

    const page =
        document.getElementById(pageId);

    if (page) {

        page.classList.add("active");

    }

    window.scrollTo(0, 0);
}


function goHome() {

    stopScanner();

    stopReceiveListener();

    showPage("homePage");
}


function openSendPage() {

    populateSendAccounts();

    document.getElementById("sendPin").value = "";

    showPage("sendPage");
}


function openReceivePage() {

    populateReceiveAccounts();

    document
        .getElementById("receiveForm")
        .classList.remove("hidden");

    document
        .getElementById("qrArea")
        .classList.add("hidden");

    document
        .getElementById("receiveSuccess")
        .classList.add("hidden");

    showPage("receivePage");
}


function openAccountsPage() {

    renderAccounts();

    showPage("accountsPage");
}


function openTransactionsPage() {

    renderTransactions();

    showPage("transactionsPage");
}



/* =========================================================
   ACCOUNTS
========================================================= */

function addAccount() {

    const provider =
        document
            .getElementById("accountProvider")
            .value
            .trim();

    const number =
        document
            .getElementById("accountNumber")
            .value
            .trim();

    const name =
        document
            .getElementById("accountName")
            .value
            .trim();

    const pin =
        document
            .getElementById("accountPin")
            .value
            .trim();


    if (!provider) {

        showToast("Please select a provider.", "error");

        return;
    }


    if (!number) {

        showToast("Please enter the account or mobile number.", "error");

        return;
    }


    if (!name) {

        showToast("Please enter the account name.", "error");

        return;
    }


    if (!pin) {

        showToast("Please enter a PIN/password for this demo account.", "error");

        return;
    }


    const account = {

        id:
            "acc_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .substring(2, 8),

        provider: provider,

        number: number,

        name: name,

        pin: pin,

        createdAt:
            new Date().toISOString()

    };


    accounts.push(account);

    saveAccounts();


    document
        .getElementById("accountProvider")
        .value = "";

    document
        .getElementById("accountNumber")
        .value = "";

    document
        .getElementById("accountName")
        .value = "";

    document
        .getElementById("accountPin")
        .value = "";


    renderAccounts();

    showToast("Account added successfully.", "success");
}



/* =========================================================
   RENDER ACCOUNTS
========================================================= */

function renderAccounts() {

    const container =
        document.getElementById("accountsList");

    if (!container) return;


    container.innerHTML = "";


    if (accounts.length === 0) {

        container.innerHTML = `

            <div class="empty-transactions">

                <strong>No accounts yet</strong>

                <p>
                    Add a TNM, Airt
