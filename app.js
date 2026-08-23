// ==========================================
// QUICKPAY + FIREBASE
// ==========================================


// ==========================================
// FIREBASE CONFIGURATION
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


// Initialize Firebase
firebase.initializeApp(
    firebaseConfig
);


// Realtime Database
const database =
    firebase.database();


// ==========================================
// APP VARIABLES
// ==========================================

let balance = 50000;

let currentPayment = null;

let currentReceiver = null;

let scanner = null;

let senderTransactionListener = null;


// ==========================================
// SCREEN NAVIGATION
// ==========================================

function showScreen(screenName) {

    document
        .querySelectorAll(".screen")
        .forEach(screen => {

            screen.classList.remove(
                "active"
            );

        });


    const screen =
        document.getElementById(
            screenName
        );


    if (screen) {

        screen.classList.add(
            "active"
        );

    }


    if (
        screenName !== "receive" &&
        scanner
    ) {

        stopScanner();

    }


    if (
        screenName === "home"
    ) {

        loadAccounts();

        loadBalance();

    }


    if (
        screenName === "send"
    ) {

        loadSendAccounts();

    }

}


// ==========================================
// LOCAL ACCOUNT STORAGE
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

        return JSON.parse(
            accounts
        );

    }

    catch (error) {

        console.error(
            error
        );

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
// REGISTER ACCOUNT
// ==========================================

document
    .getElementById(
        "registerForm"
    )
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


            if (
                !/^\d{4}$/.test(pin)
            ) {

                showToast(
                    "Invalid PIN",
                    "Demo PIN must contain 4 digits."
                );

                return;

            }


            const accounts =
                getAccounts();


            const account = {

                id:
                    "ACC-" +
                    Date.now(),

                provider:
                    provider,

                accountNumber:
                    accountNumber,

                accountName:
                    accountName,

                pin:
                    pin

            };


            accounts.push(
                account
            );


            saveAccounts(
                accounts
            );


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
                () => {

                    showScreen(
                        "home"
                    );

                },
                700
            );

        }
    );


// ==========================================
// DISPLAY ACCOUNTS
// ==========================================

function loadAccounts() {

    const accounts =
        getAccounts();


    const container =
        document.getElementById(
            "accountsList"
        );


    if (
        accounts.length === 0
    ) {

        container.innerHTML =
            '<p class="empty">' +
            'No accounts registered yet.' +
            '</p>';

        return;

    }


    container.innerHTML =
        "";


    accounts.forEach(
        account => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "account-item";


            item.innerHTML = `

                <strong>
                    ${escapeHTML(
                        account.provider
                    )}
                </strong>

                <span>
                    ${escapeHTML(
                        account.accountName
                    )}
                </span>

                <span>
                    ${maskAccount(
                        account.accountNumber
                    )}
                </span>

            `;


            container.appendChild(
                item
            );

        }
    );

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


    accounts.forEach(
        account => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                account.id;


            option.textContent =
                `${account.provider} - ` +
                `${maskAccount(
                    account.accountNumber
                )}`;


            select.appendChild(
                option
            );

        }
    );

}


// ==========================================
// CREATE PAYMENT
// ==========================================

document
    .getElementById(
        "sendForm"
    )
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


            if (!accountID) {

                showToast(
                    "Select account",
                    "Choose an account to send from."
                );

                return;

            }


            if (
                !amount ||
                amount <= 0
            ) {

                showToast(
                    "Invalid amount",
                    "Enter a valid amount."
                );

                return;

            }


            if (
                amount > balance
            ) {

                showToast(
                    "Insufficient balance",
                    "Your demo balance is too low."
                );

                return;

            }


            const accounts =
                getAccounts();


            const account =
                accounts.find(
                    acc =>
                        acc.id ===
                        accountID
                );


            if (!account) {

                showToast(
                    "Account error",
                    "Account could not be found."
                );

                return;

            }


            if (
                account.pin !== pin
            ) {

                showToast(
                    "Incorrect PIN",
                    "The demo PIN is incorrect."
                );

                return;

            }


            // ==================================
            // UNIQUE TRANSACTION ID
            // ==================================

            const transactionID =
                "QP-" +
                Date.now() +
                "-" +
                Math.floor(
                    Math.random() *
                    10000
                );


            // ==================================
            // TRANSACTION DATA
            // ==================================

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

                // ==================================
                // SAVE TO FIREBASE
                // ==================================

                await database
                    .ref(
                        "transactions/" +
                        transactionID
                    )
                    .set(
                        transaction
                    );


                // ==================================
                // CREATE QR
                // ==================================

                const qrContainer =
                    document.getElementById(
                        "qrcode"
                    );


                qrContainer.innerHTML =
                    "";


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
                            JSON.stringify(
                                qrData
                            ),

                        width:
                            220,

                        height:
                            220,

                        correctLevel:
                            QRCode.CorrectLevel.M

                    }
                );


                // ==================================
                // SHOW PAYMENT DETAILS
                // ==================================

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


                // ==================================
                // START WATCHING FIREBASE
                // ==================================

                watchTransaction(
                    transactionID
                );


                showScreen(
                    "paymentQR"
                );


            }

            catch (error) {

                console.error(
                    "Firebase error:",
                    error
                );


                showToast(
                    "Firebase error",
                    "Could not create the payment."
                );

            }

        }
    );


// ==========================================
// WATCH TRANSACTION
// ==========================================

function watchTransaction(
    transactionID
) {

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


            console.log(
                "Transaction update:",
                transaction
            );


            // ==================================
            // ACTIVE
            // ==================================

            if (
                transaction.status ===
                "active"
            ) {

                updateSenderStatus(
                    "active"
                );

            }


            // ==================================
            // SCANNED
            // ==================================

            if (
                transaction.status ===
                "scanned"
            ) {

                updateSenderStatus(
                    "scanned",
                    transaction
                );

            }


            // ==================================
            // DONE
            // ==================================

            if (
                transaction.status ===
                "done"
            ) {

                updateSenderStatus(
                    "done",
                    transaction
                );


                showSenderCompleted(
                    transaction
                );

            }


            // ==================================
            // CANCELLED
            // ==================================

            if (
                transaction.status ===
                "cancelled"
            ) {

                updateSenderStatus(
                    "cancelled"
                );

            }

        }
    );

}


// ==========================================
// STOP LISTENER
// ==========================================

function stopWatchingTransaction() {

    if (
        senderTransactionListener
    ) {

        senderTransactionListener.off();

        senderTransactionListener =
            null;

    }

}


// ==========================================
// SENDER STATUS
// ==========================================

function updateSenderStatus(
    status,
    transaction = null
) {

    const element =
        document.getElementById(
            "senderStatus"
        );


    if (
        status === "active"
    ) {

        element.innerHTML =
            "🟡 Waiting for receiver to scan...";

        return;

    }


    if (
        status === "scanned"
    ) {

        const receiver =
            transaction.receiver;


        element.innerHTML = `

            🟢 <strong>
                QR CODE SCANNED
            </strong>

            <br><br>

            ${escapeHTML(
                receiver?.name ||
                "Receiver"
            )}
            has scanned your payment.

            <br>

            Waiting for confirmation...

        `;

        return;

    }


    if (
        status === "done"
    ) {

        element.innerHTML = `

            🟢 <strong>
                PAYMENT COMPLETED
            </strong>

            <br><br>

            The receiver has successfully
            received the payment.

        `;

        return;

    }


    if (
        status === "cancelled"
    ) {

        element.innerHTML = `

            🔴 <strong>
                PAYMENT CANCELLED
            </strong>

        `;

    }

}


// ==========================================
// SHOW SENDER COMPLETION
// ==========================================

function showSenderCompleted(
    transaction
) {

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
            transaction
                .receiver
                ?.accountNumber
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


    // Stop listening because
    // transaction is now complete.

    stopWatchingTransaction();


    // Show completion page
    showScreen(
        "senderCompleted"
    );

}


// ==========================================
// START CAMERA
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


            const config = {

                fps: 10,

                qrbox: {

                    width: 250,

                    height: 250

                }

            };


            scanner
                .start(

                    {
                        facingMode:
                            "environment"
                    },

                    config,

                    onScanSuccess,

                    onScanFailure

                )

                .catch(
                    error => {

                        console.error(
                            error
                        );


                        document
                            .getElementById(
                                "scanResult"
                            )
                            .innerHTML = `

                                <div class="warning">

                                    Camera could not be opened.

                                    <br><br>

                                    Please allow
                                    camera permission.

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
    decodedText,
    decodedResult
) {

    console.log(
        "QR detected:",
        decodedText
    );


    stopScanner();


    try {

        const qr =
            JSON.parse(
                decodedText
            );


        if (
            qr.app !==
            "QuickPay"
        ) {

            showToast(
                "Invalid QR",
                "This is not a QuickPay QR."
            );

            return;

        }


        const transactionID =
            qr.transactionId;


        if (!transactionID) {

            showToast(
                "Invalid QR",
                "Transaction ID is missing."
            );

            return;

        }


        // ==================================
        // GET TRANSACTION
        // ==================================

        const snapshot =
            await database
                .ref(
                    "transactions/" +
                    transactionID
                )
                .once(
                    "value"
                );


        const transaction =
            snapshot.val();


        if (!transaction) {

            showToast(
                "Transaction not found",
                "This payment does not exist."
            );

            return;

        }


        // ==================================
        // PREVENT REUSE
        // ==================================

        if (
            transaction.status ===
            "done"
        ) {

            showToast(
                "Payment already completed",
                "This QR code has already been used."
            );


            setTimeout(
                () => {

                    showScreen(
                        "home"
                    );

                },
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


        // ==================================
        // FIND RECEIVER
        // ==================================

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
                () => {

                    showScreen(
                        "home"
                    );

                },
                1800
            );


            return;

        }


        currentPayment =
            transaction;


        currentReceiver =
            receiver;


        // ==================================
        // MARK AS SCANNED
        // ==================================

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


        // ==================================
        // SHOW RECEIVER NOTIFICATION
        // ==================================

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


        showToast(

            "Payment found",

            `MWK ${Number(
                transaction.amount
            ).toLocaleString()} from ${transaction.sender.name}`

        );


        setTimeout(
            () => {

                showScreen(
                    "notification"
                );

            },
            500
        );

    }

    catch (error) {

        console.error(
            "Scan processing error:",
            error
        );


        showToast(
            "Scan error",
            "Could not process this QR."
        );

    }

}


// ==========================================
// SCAN FAILURE
// ==========================================

function onScanFailure(error) {

    // Continuous scanner errors
    // are intentionally ignored.

}


// ==========================================
// STOP CAMERA
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
            error => {

                console.log(
                    error
                );

                scanner =
                    null;

            }
        );

}


// ==========================================
// RECEIVER CONFIRMS
// ==========================================

async function confirmReceive() {

    if (
        !currentPayment ||
        !currentReceiver
    ) {

        showScreen(
            "home"
        );

        return;

    }


    const transactionID =
        currentPayment.transactionId;


    try {

        // ==================================
        // READ CURRENT DATABASE STATE
        // ==================================

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
                "This transaction no longer exists."
            );

            return;

        }


        // ==================================
        // ALREADY COMPLETED?
        // ==================================

        if (
            transaction.status ===
            "done"
        ) {

            showToast(
                "Already completed",
                "This payment has already been received."
            );

            showScreen(
                "home"
            );

            return;

        }


        // ==================================
        // UPDATE TO DONE
        // ==================================

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


        // ==================================
        // UPDATE LOCAL DEMO BALANCE
        // ==================================

        balance +=
            Number(
                transaction.amount
            );


        localStorage.setItem(
            "quickpay_balance",
            balance
        );


        // ==================================
        // SHOW SUCCESS
        // ==================================

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

    catch (error) {

        console.error(
            "Confirmation error:",
            error
        );


        showToast(
            "Payment error",
            "Could not complete the payment."
        );

    }

}


// ==========================================
// CANCEL PAYMENT
// ==========================================

async function cancelPayment() {

    if (!currentPayment) {

        showScreen(
            "home"
        );

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

    catch (error) {

        console.error(
            error
        );

    }


    stopWatchingTransaction();


    currentPayment =
        null;


    showScreen(
        "home"
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


    if (
        saved !== null
    ) {

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
// MASK ACCOUNT
// ==========================================

function maskAccount(
    account
) {

    if (!account) {

        return "—";

    }


    if (
        account.length <= 4
    ) {

        return account;

    }


    return (
        "•••• " +
        account.slice(-4)
    );

}


// ==========================================
// FORMAT DATE
// ==========================================

function formatDate(
    dateString
) {

    if (!dateString) {

        return "—";

    }


    const date =
        new Date(
            dateString
        );


    return date.toLocaleString(
        [],
        {

            dateStyle:
                "medium",

            timeStyle:
                "short"

        }
    );

}


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHTML(
    text
) {

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
