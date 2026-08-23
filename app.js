// ==========================================
// QUICKPAY + FIREBASE
// ==========================================

const firebaseConfig = {

    apiKey:
        "AIzaSyC9cQ5SRO5hrHMRywxAiQQ--uYdIXL57fw",

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

const database = firebase.database();


// ==========================================
// VARIABLES
// ==========================================

let balance = 50000;

let currentPayment = null;

let currentReceiver = null;

let scanner = null;

let senderTransactionListener = null;

let currentTransactionType = "sent";


// ==========================================
// NAVIGATION
// ==========================================

function showScreen(screenName) {

    document
        .querySelectorAll(".screen")
        .forEach(screen => {

            screen.classList.remove("active");

        });


    const screen =
        document.getElementById(screenName);


    if (screen) {

        screen.classList.add("active");

    }


    if (
        screenName !== "receive" &&
        scanner
    ) {

        stopScanner();

    }


    if (screenName === "home") {

        loadAccounts();

        loadBalance();

    }

}


// ==========================================
// ACCOUNTS
// ==========================================

function getAccounts() {

    const accounts =
        localStorage.getItem(
            "quickpay_accounts"
        );


    if (!accounts) {

        return [];

    }


    try {

        return JSON.parse(accounts);

    }

    catch {

        return [];

    }

}


function saveAccounts(accounts) {

    localStorage.setItem(
        "quickpay_accounts",
        JSON.stringify(accounts)
    );

}


// ==========================================
// REGISTER
// ==========================================

document
    .getElementById("registerForm")
    .addEventListener(
        "submit",
        function(event) {

            event.preventDefault();


            const provider =
                document.getElementById(
                    "provider"
                ).value;


            const accountNumber =
                document.getElementById(
                    "accountNumber"
                ).value.trim();


            const accountName =
                document.getElementById(
                    "accountName"
                ).value.trim();


            const pin =
                document.getElementById(
                    "pin"
                ).value.trim();


            if (
                !provider ||
                !accountNumber ||
                !accountName ||
                !pin
            ) {

                showToast(
                    "Missing information",
                    "Please complete all fields."
                );

                return;

            }


            if (!/^\d{4}$/.test(pin)) {

                showToast(
                    "Invalid PIN",
                    "Demo PIN must contain 4 digits."
                );

                return;

            }


            const accounts =
                getAccounts();


            accounts.push({

                id:
                    "ACC-" +
                    Date.now(),

                provider,

                accountNumber,

                accountName,

                pin

            });


            saveAccounts(accounts);


            showToast(
                "Account registered",
                `${provider} account saved.`
            );


            document
                .getElementById(
                    "registerForm"
                )
                .reset();


            setTimeout(
                () => showScreen("home"),
                700
            );

        }
    );


// ==========================================
// ACCOUNT DISPLAY
// ==========================================

function loadAccounts() {

    const accounts =
        getAccounts();


    const container =
        document.getElementById(
            "accountsList"
        );


    if (!accounts.length) {

        container.innerHTML =
            '<p class="empty">' +
            'No accounts registered yet.' +
            '</p>';

        return;

    }


    container.innerHTML = "";


    accounts.forEach(account => {

        const item =
            document.createElement("div");


        item.className =
            "account-item";


        item.innerHTML = `

            <strong>
                ${escapeHTML(account.provider)}
            </strong>

            <span>
                ${escapeHTML(account.accountName)}
            </span>

            <span>
                ${maskAccount(account.accountNumber)}
            </span>

        `;


        container.appendChild(item);

    });

}


// ==========================================
// SEND ACCOUNT DROPDOWN
// ==========================================

function loadSendAccounts() {

    const select =
        document.getElementById(
            "sendAccount"
        );


    const accounts =
        getAccounts();


    select.innerHTML =
        '<option value="">Select account</option>';


    accounts.forEach(account => {

        const option =
            document.createElement("option");


        option.value =
            account.id;


        option.textContent =
            `${account.provider} - ` +
            `${maskAccount(account.accountNumber)}`;


        select.appendChild(option);

    });

}


// ==========================================
// SEND
// ==========================================

document
    .getElementById("sendForm")
    .addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();


            const accountID =
                document.getElementById(
                    "sendAccount"
                ).value;


            const amount =
                Number(
                    document.getElementById(
                        "amount"
                    ).value
                );


            const pin =
                document.getElementById(
                    "sendPin"
                ).value.trim();


            const accounts =
                getAccounts();


            const account =
                accounts.find(
                    acc =>
                        acc.id === accountID
                );


            if (!account) {

                showToast(
                    "Account error",
                    "Select a valid account."
                );

                return;

            }


            if (!amount || amount <= 0) {

                showToast(
                    "Invalid amount",
                    "Enter a valid amount."
                );

                return;

            }


            if (amount > balance) {

                showToast(
                    "Insufficient balance",
                    "Your demo balance is too low."
                );

                return;

            }


            if (account.pin !== pin) {

                showToast(
                    "Incorrect PIN",
                    "The demo PIN is incorrect."
                );

                return;

            }


            const transactionID =
                "QP-" +
                Date.now() +
                "-" +
                Math.floor(
                    Math.random() * 10000
                );


            const transaction = {

                app:
                    "QuickPay",

                transactionId:
                    transactionID,

                status:
                    "active",

                provider:
                    account.provider,

                amount:
                    amount,

                sender: {

                    name:
                        account.accountName,

                    accountNumber:
                        account.accountNumber

                },

                createdAt:
                    new Date().toISOString(),

                receiver:
                    null,

                completedAt:
                    null

            };


            try {

                await database
                    .ref(
                        "transactions/" +
                        transactionID
                    )
                    .set(transaction);


                const qrContainer =
                    document.getElementById(
                        "qrcode"
                    );


                qrContainer.innerHTML = "";


                const qrData = {

                    app:
                        "QuickPay",

                    transactionId:
                        transactionID

                };


                new QRCode(
                    qrContainer,
                    {

                        text:
                            JSON.stringify(qrData),

                        width:
                            250,

                        height:
                            250,

                        correctLevel:
                            QRCode.CorrectLevel.M

                    }
                );


                document.getElementById(
                    "qrProvider"
                ).textContent =
                    account.provider;


                document.getElementById(
                    "qrAmount"
                ).textContent =
                    amount.toLocaleString();


                document.getElementById(
                    "qrSender"
                ).textContent =
                    account.accountName;


                document.getElementById(
                    "qrTransaction"
                ).textContent =
                    transactionID;


                document.getElementById(
                    "senderStatus"
                ).innerHTML =
                    "🟡 Waiting for receiver to scan...";


                currentPayment =
                    transaction;


                watchTransaction(
                    transactionID
                );


                showScreen(
                    "paymentQR"
                );

            }

            catch(error) {

                console.error(error);


                showToast(
                    "Firebase error",
                    "Could not create payment."
                );

            }

        }
    );


// ==========================================
// WATCH TRANSACTION
// ==========================================

function watchTransaction(transactionID) {

    stopWatchingTransaction();


    const reference =
        database.ref(
            "transactions/" +
            transactionID
        );


    senderTransactionListener =
        reference;


    reference.on(
        "value",
        snapshot => {

            const transaction =
                snapshot.val();


            if (!transaction) {

                return;

            }


            if (
                transaction.status ===
                "active"
            ) {

                document.getElementById(
                    "senderStatus"
                ).innerHTML =
                    "🟡 Waiting for receiver to scan...";

            }


            if (
                transaction.status ===
                "scanned"
            ) {

                document.getElementById(
                    "senderStatus"
                ).innerHTML = `

                    🟢 <strong>
                    QR CODE SCANNED
                    </strong>

                    <br><br>

                    ${
                        escapeHTML(
                            transaction
                                .receiverPreview
                                ?.name ||
                            "Receiver"
                        )
                    }
                    has scanned your QR.

                    <br>

                    Waiting for confirmation...

                `;

            }


            if (
                transaction.status ===
                "done"
            ) {

                showSenderCompleted(
                    transaction
                );

            }

        }
    );

}


// ==========================================
// STOP LISTENER
// ==========================================

function stopWatchingTransaction() {

    if (senderTransactionListener) {

        senderTransactionListener.off();

        senderTransactionListener =
            null;

    }

}


// ==========================================
// SENDER COMPLETED
// ==========================================

function showSenderCompleted(transaction) {

    document.getElementById(
        "senderCompletedAmount"
    ).textContent =
        Number(
            transaction.amount
        ).toLocaleString();


    document.getElementById(
        "senderCompletedReceiver"
    ).textContent =
        transaction.receiver?.name ||
        "Unknown";


    document.getElementById(
        "senderCompletedProvider"
    ).textContent =
        transaction.provider;


    document.getElementById(
        "senderCompletedAccount"
    ).textContent =
        maskAccount(
            transaction.receiver?.accountNumber
        );


    document.getElementById(
        "senderCompletedTransaction"
    ).textContent =
        transaction.transactionId;


    document.getElementById(
        "senderCompletedTime"
    ).textContent =
        formatDate(
            transaction.completedAt
        );


    stopWatchingTransaction();


    showScreen(
        "senderCompleted"
    );

}


// ==========================================
// DONE BUTTON
// ==========================================

function finishQRScreen() {

    /*
       IMPORTANT:

       Done DOES NOT cancel the transaction.

       The transaction remains ACTIVE in Firebase.

       Therefore the receiver can scan the
       saved/shared QR later.
    */


    stopWatchingTransaction();


    showToast(
        "QR saved as active payment",
        "The receiver can scan it later."
    );


    setTimeout(
        () => showScreen("home"),
        800
    );

}


// ==========================================
// GENERATE QR CANVAS / PNG
// ==========================================

function getQRCanvas() {

    const qr =
        document.getElementById(
            "qrcode"
        );


    if (!qr) {

        return null;

    }


    return qr.querySelector(
        "canvas"
    );

}


// ==========================================
// SAVE QR PNG
// ==========================================

function saveQR() {

    const canvas =
        getQRCanvas();


    if (!canvas) {

        showToast(
            "QR unavailable",
            "Generate a payment QR first."
        );

        return;

    }


    canvas.toBlob(
        function(blob) {

            if (!blob) {

                showToast(
                    "Save failed",
                    "Could not create PNG."
                );

                return;

            }


            const url =
                URL.createObjectURL(
                    blob
                );


            const link =
                document.createElement(
                    "a"
                );


            link.href =
                url;


            link.download =
                currentPayment
                    ? currentPayment.transactionId +
                      ".png"
                    : "QuickPay-QR.png";


            document.body.appendChild(
                link
            );


            link.click();


            link.remove();


            URL.revokeObjectURL(
                url
            );


            showToast(
                "QR saved",
                "The QR PNG has been saved."
            );

        },
        "image/png"
    );

}


// ==========================================
// SHARE QR
// ==========================================

async function shareQR() {

    const canvas =
        getQRCanvas();


    if (!canvas) {

        showToast(
            "QR unavailable",
            "Generate a payment QR first."
        );

        return;

    }


    canvas.toBlob(
        async function(blob) {

            if (!blob) {

                return;

            }


            const file =
                new File(

                    [blob],

                    currentPayment
                        ? currentPayment.transactionId +
                          ".png"
                        : "QuickPay-QR.png",

                    {
                        type:
                            "image/png"
                    }

                );


            // Modern mobile browsers
            // can open the native share sheet.

            if (
                navigator.share &&
                navigator.canShare &&
                navigator.canShare({
                    files: [file]
                })
            ) {

                try {

                    await navigator.share({

                        title:
                            "QuickPay Payment",

                        text:
                            "Scan this QuickPay QR to receive the payment.",

                        files:
                            [file]

                    });


                    return;

                }

                catch(error) {

                    if (
                        error.name ===
                        "AbortError"
                    ) {

                        return;

                    }

                }

            }


            // Fallback:
            // download PNG.

            saveQR();


            showToast(
                "Sharing unavailable",
                "The QR was downloaded instead."
            );

        },
        "image/png"
    );

}


// ==========================================
// SCANNER
// ==========================================

function startScanner() {

    showScreen(
        "receive"
    );


    setTimeout(
        () => {

            if (scanner) {

                return;

            }


            scanner =
                new Html5Qrcode(
                    "reader"
                );


            scanner
                .start(

                    {
                        facingMode:
                            "environment"
                    },

                    {
                        fps: 10,

                        qrbox: {
                            width: 250,
                            height: 250
                        }

                    },

                    onScanSuccess,

                    onScanFailure

                )
                .catch(
                    error => {

                        console.error(error);


                        document
                            .getElementById(
                                "scanResult"
                            )
                            .innerHTML = `

                                <div class="warning">

                                    Camera could not be opened.

                                    <br><br>

                                    Please allow camera permission.

                                </div>

                            `;

                    }
                );

        },
        300
    );

}


// ==========================================
// QR SCANNED
// ==========================================

async function onScanSuccess(
    decodedText
) {

    stopScanner();


    try {

        const qr =
            JSON.parse(
                decodedText
            );


        if (
            qr.app !== "QuickPay" ||
            !qr.transactionId
        ) {

            showToast(
                "Invalid QR",
                "This is not a QuickPay QR."
            );

            return;

        }


        const transactionID =
            qr.transactionId;


        const snapshot =
            await database
                .ref(
                    "transactions/" +
                    transactionID
                )
                .once("value");


        const transaction =
            snapshot.val();


        if (!transaction) {

            showToast(
                "Transaction not found",
                "This payment does not exist."
            );

            return;

        }


        // PREVENT REUSE

        if (
            transaction.status ===
            "done"
        ) {

            showToast(
                "Payment already completed",
                "This QR code has already been used."
            );


            setTimeout(
                () => showScreen("home"),
                1800
            );


            return;

        }


        if (
            transaction.status ===
            "cancelled"
        ) {

            showToast(
                "Payment cancelled",
                "This payment is no longer active."
            );

            return;

        }


        const accounts =
            getAccounts();


        const receiver =
            accounts.find(
                account =>
                    account.provider ===
                    transaction.provider
            );


        if (!receiver) {

            showToast(
                "Account not found",
                `Register a ${transaction.provider} account first.`
            );


            setTimeout(
                () => showScreen("home"),
                1800
            );


            return;

        }


        currentPayment =
            transaction;


        currentReceiver =
            receiver;


        // MARK SCANNED

        await database
            .ref(
                "transactions/" +
                transactionID
            )
            .update({

                status:
                    "scanned",

                scannedAt:
                    new Date().toISOString(),

                receiverPreview: {

                    name:
                        receiver.accountName,

                    provider:
                        receiver.provider

                }

            });


        // DISPLAY PAYMENT

        document.getElementById(
            "notificationAmount"
        ).textContent =
            Number(
                transaction.amount
            ).toLocaleString();


        document.getElementById(
            "notificationSender"
        ).textContent =
            transaction.sender.name;


        document.getElementById(
            "notificationProvider"
        ).textContent =
            transaction.provider;


        document.getElementById(
            "notificationReceiver"
        ).textContent =
            receiver.accountName;


        document.getElementById(
            "notificationAccount"
        ).textContent =
            maskAccount(
                receiver.accountNumber
            );


        document.getElementById(
            "notificationTransaction"
        ).textContent =
            transaction.transactionId;


        showScreen(
            "notification"
        );

    }

    catch(error) {

        console.error(error);


        showToast(
            "Scan error",
            "Could not process this QR."
        );

    }

}


function onScanFailure() {

}


// ==========================================
// STOP SCANNER
// ==========================================

function stopScanner() {

    if (!scanner) {

        return;

    }


    scanner
        .stop()
        .then(
            () => {

                scanner.clear();

                scanner =
                    null;

            }
        )
        .catch(
            () => {

                scanner =
                    null;

            }
        );

}


// ==========================================
// CONFIRM RECEIVE
// ==========================================

async function confirmReceive() {

    if (
        !currentPayment ||
        !currentReceiver
    ) {

        showScreen("home");

        return;

    }


    const transactionID =
        currentPayment.transactionId;


    try {

        const reference =
            database.ref(
                "transactions/" +
                transactionID
            );


        const snapshot =
            await reference.once(
                "value"
            );


        const transaction =
            snapshot.val();


        if (!transaction) {

            showToast(
                "Transaction missing",
                "Transaction no longer exists."
            );

            return;

        }


        if (
            transaction.status ===
            "done"
        ) {

            showToast(
                "Already completed",
                "This payment has already been received."
            );


            showScreen("home");

            return;

        }


        await reference.update({

            status:
                "done",

            receiver: {

                name:
                    currentReceiver.accountName,

                accountNumber:
                    currentReceiver.accountNumber,

                provider:
                    currentReceiver.provider

            },

            completedAt:
                new Date().toISOString()

        });


        balance +=
            Number(
                transaction.amount
            );


        localStorage.setItem(
            "quickpay_balance",
            balance
        );


        document.getElementById(
            "successAmount"
        ).textContent =
            Number(
                transaction.amount
            ).toLocaleString();


        document.getElementById(
            "successSender"
        ).textContent =
            transaction.sender.name;


        document.getElementById(
            "successProvider"
        ).textContent =
            transaction.provider;


        document.getElementById(
            "successReceiver"
        ).textContent =
            currentReceiver.accountName;


        document.getElementById(
            "successTransaction"
        ).textContent =
            transaction.transactionId;


        currentPayment =
            null;


        currentReceiver =
            null;


        showScreen(
            "success"
        );

    }

    catch(error) {

        console.error(error);


        showToast(
            "Payment error",
            "Could not complete payment."
        );

    }

}


// ==========================================
// CANCEL
// ==========================================

async function cancelPayment() {

    if (!currentPayment) {

        showScreen("home");

        return;

    }


    try {

        await database
            .ref(
                "transactions/" +
                currentPayment.transactionId
            )
            .update({

                status:
                    "cancelled",

                cancelledAt:
                    new Date().toISOString()

            });

    }

    catch(error) {

        console.error(error);

    }


    stopWatchingTransaction();


    currentPayment =
        null;


    showScreen("home");

}


// ==========================================
// TRANSACTION HISTORY
// ==========================================

async function showTransactions() {

    showScreen(
        "transactions"
    );


    await loadTransactions(
        "sent"
    );

}


// ==========================================
// LOAD TRANSACTIONS
// ==========================================

async function loadTransactions(
    type
) {

    currentTransactionType =
        type;


    const container =
        document.getElementById(
            "transactionList"
        );


    container.innerHTML =
        '<p class="empty">Loading...</p>';


    const accounts =
        getAccounts();


    if (!accounts.length) {

        container.innerHTML =
            '<p class="empty">' +
            'Register an account first.' +
            '</p>';

        return;

    }


    try {

        const snapshot =
            await database
                .ref("transactions")
                .once("value");


        const data =
            snapshot.val();


        if (!data) {

            container.innerHTML =
                '<p class="empty">' +
                'No transactions yet.' +
                '</p>';

            return;

        }


        const transactions =
            Object.values(data);


        const accountNumbers =
            accounts.map(
                account =>
                    account.accountNumber
            );


        const accountNames =
            accounts.map(
                account =>
                    account.accountName
            );


        let filtered;


        if (type === "sent") {

            filtered =
                transactions.filter(
                    transaction =>

                        transaction.sender &&

                        (
                            accountNumbers.includes(
                                transaction.sender.accountNumber
                            ) ||

                            accountNames.includes(
                                transaction.sender.name
                            )
                        )

                );

        }

        else {

            filtered =
                transactions.filter(
                    transaction =>

                        transaction.receiver &&

                        (
                            accountNumbers.includes(
                                transaction.receiver.accountNumber
                            ) ||

                            accountNames.includes(
                                transaction.receiver.name
                            )
                        )

                );

        }


        filtered.sort(
            (a, b) =>
                new Date(
                    b.completedAt ||
                    b.createdAt
                ) -
                new Date(
                    a.completedAt ||
                    a.createdAt
                )
        );


        if (!filtered.length) {

            container.innerHTML =
                '<p class="empty">' +
                `No ${type} transactions yet.` +
                '</p>';

            return;

        }


        container.innerHTML =
            "";


        filtered.forEach(
            transaction => {

                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "transaction-item";


                const isDone =
                    transaction.status ===
                    "done";


                const statusClass =
                    isDone
                        ? "transaction-done"
                        : "transaction-active";


                const person =
                    type === "sent"

                        ? (
                            transaction
                                .receiver
                                ?.name ||
                            "Waiting for receiver"
                        )

                        : transaction.sender?.name;


                const direction =
                    type === "sent"
                        ? "Sent to"
                        : "Received from";


                item.innerHTML = `

                    <div class="transaction-top">

                        <div>

                            <strong>
                                ${escapeHTML(
                                    direction
                                )}
                            </strong>

                            <span>
                                ${escapeHTML(
                                    person || "Unknown"
                                )}
                            </span>

                        </div>


                        <strong
                            class="${
                                type === "sent"
                                    ? "money-out"
                                    : "money-in"
                            }">

                            ${
                                type === "sent"
                                    ? "-"
                                    : "+"
                            }

                            MWK
                            ${Number(
                                transaction.amount
                            ).toLocaleString()}

                        </strong>

                    </div>


                    <div class="transaction-bottom">

                        <span>
                            ${escapeHTML(
                                transaction.provider
                            )}
                        </span>

                        <span>
                            ${formatDate(
                                transaction.completedAt ||
                                transaction.createdAt
                            )}
                        </span>

                    </div>


                    <div class="transaction-status ${statusClass}">

                        ${
                            isDone
                                ? "✓ Completed"
                                : "🟡 Active"
                        }

                    </div>

                `;


                container.appendChild(
                    item
                );

            }
        );

    }

    catch(error) {

        console.error(error);


        container.innerHTML =
            '<p class="empty">' +
            'Could not load transactions.' +
            '</p>';

    }

}


// ==========================================
// TRANSACTION TAB
// ==========================================

function showTransactionType(
    type
) {

    document
        .getElementById(
            "sentTab"
        )
        .classList.toggle(
            "active",
            type === "sent"
        );


    document
        .getElementById(
            "receivedTab"
        )
        .classList.toggle(
            "active",
            type === "received"
        );


    loadTransactions(
        type
    );

}


// ==========================================
// BALANCE
// ==========================================

function loadBalance() {

    const saved =
        localStorage.getItem(
            "quickpay_balance"
        );


    if (saved !== null) {

        balance =
            Number(saved);

    }


    const element =
        document.getElementById(
            "balance"
        );


    if (element) {

        element.textContent =
            balance.toLocaleString();

    }

}


// ==========================================
// HELPERS
// ==========================================

function maskAccount(account) {

    if (!account) {

        return "—";

    }


    if (account.length <= 4) {

        return account;

    }


    return "•••• " +
        account.slice(-4);

}


function formatDate(dateString) {

    if (!dateString) {

        return "—";

    }


    return new Date(
        dateString
    ).toLocaleString(
        [],
        {
            dateStyle: "medium",
            timeStyle: "short"
        }
    );

}


function escapeHTML(text) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        text;


    return div.innerHTML;

}


// ==========================================
// TOAST
// ==========================================

function showToast(
    title,
    message
) {

    const toast =
        document.getElementById(
            "toast"
        );


    document.getElementById(
        "toastTitle"
    ).textContent =
        title;


    document.getElementById(
        "toastMessage"
    ).textContent =
        message;


    toast.classList.add(
        "show"
    );


    setTimeout(
        () => {

            toast.classList.remove(
                "show"
            );

        },
        3500
    );

}


// ==========================================
// INITIALIZE
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    function() {

        loadAccounts();

        loadBalance();

    }
);
