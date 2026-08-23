// ==========================================
// QUICKPAY MOCK PAYMENT SYSTEM
// ==========================================

let balance = 50000;

let currentPayment = null;

let currentReceiver = null;

let scanner = null;


// ==========================================
// SCREEN NAVIGATION
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


    if (screenName === "send") {

        loadSendAccounts();

    }

}


// ==========================================
// ACCOUNT STORAGE
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

    catch (error) {

        console.error(
            "Account storage error:",
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


            accounts.push(account);

            saveAccounts(accounts);


            showToast(
                "Account registered",
                `${provider} account saved successfully.`
            );


            document
                .getElementById(
                    "registerForm"
                )
                .reset();


            setTimeout(
                () => {

                    showScreen("home");

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


    container.innerHTML = "";


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

        }
    );

}


// ==========================================
// LOAD SEND ACCOUNTS
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


    if (
        accounts.length === 0
    ) {

        const option =
            document.createElement(
                "option"
            );


        option.textContent =
            "No registered accounts";


        option.disabled = true;


        select.appendChild(option);


        return;

    }


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
                `${maskAccount(account.accountNumber)}`;


            select.appendChild(option);

        }
    );

}


// ==========================================
// SEND MONEY
// ==========================================

document
    .getElementById("sendForm")
    .addEventListener(
        "submit",
        function(event) {

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
                    "Choose the account to send from."
                );

                return;

            }


            if (
                !amount ||
                amount <= 0
            ) {

                showToast(
                    "Invalid amount",
                    "Enter a valid payment amount."
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
                        acc.id === accountID
                );


            if (!account) {

                showToast(
                    "Account error",
                    "The selected account was not found."
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


            const transactionID =
                "QP-" +
                Date.now();


            const payment = {

                app:
                    "QuickPay",

                version:
                    "1.0",

                transactionID:
                    transactionID,

                provider:
                    account.provider,

                amount:
                    amount,

                sender:
                    account.accountName,

                senderAccount:
                    account.accountNumber,

                timestamp:
                    new Date().toISOString()

            };


            const qrContainer =
                document.getElementById(
                    "qrcode"
                );


            qrContainer.innerHTML = "";


            new QRCode(
                qrContainer,
                {

                    text:
                        JSON.stringify(payment),

                    width:
                        220,

                    height:
                        220,

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


            showToast(
                "Payment QR created",
                `MWK ${amount.toLocaleString()} ready to scan.`
            );


            showScreen(
                "paymentQR"
            );

        }
    );


// ==========================================
// START SCANNER
// ==========================================

function startScanner() {

    showScreen("receive");


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

                                    Please allow camera
                                    permission.

                                </div>

                            `;

                    }
                );

        },
        300
    );

}


// ==========================================
// QR SCAN SUCCESS
// ==========================================

function onScanSuccess(
    decodedText,
    decodedResult
) {

    console.log(
        "QR detected:",
        decodedText
    );


    stopScanner();


    try {

        const payment =
            JSON.parse(
                decodedText
            );


        if (
            payment.app !==
            "QuickPay"
        ) {

            showToast(
                "Invalid QR",
                "This is not a QuickPay payment QR."
            );

            return;

        }


        if (
            !payment.amount ||
            !payment.provider ||
            !payment.sender
        ) {

            showToast(
                "Invalid payment",
                "The payment QR is incomplete."
            );

            return;

        }


        // ======================================
        // FIND RECEIVER ACCOUNT
        // ======================================

        const accounts =
            getAccounts();


        const receiver =
            accounts.find(
                account =>
                    account.provider ===
                    payment.provider
            );


        if (!receiver) {

            showToast(

                "Account not found",

                `No ${payment.provider} account is registered on this phone.`

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
            payment;


        currentReceiver =
            receiver;


        // ======================================
        // PAYMENT NOTIFICATION
        // ======================================

        document.getElementById(
            "notificationAmount"
        ).textContent =
            Number(
                payment.amount
            ).toLocaleString();


        document.getElementById(
            "notificationSender"
        ).textContent =
            payment.sender;


        document.getElementById(
            "notificationProvider"
        ).textContent =
            payment.provider;


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
            payment.transactionID;


        // Small notification popup
        showToast(

            "Payment received",

            `MWK ${Number(payment.amount).toLocaleString()} from ${payment.sender}`

        );


        // Open full notification
        setTimeout(
            () => {

                showScreen(
                    "notification"
                );

            },
            600
        );

    }

    catch (error) {

        console.error(
            error
        );


        showToast(
            "Scan error",
            "The QR code could not be understood."
        );

    }

}


// ==========================================
// QR SCAN FAILURE
// ==========================================

function onScanFailure(error) {

    // Continuous scanner errors are ignored.

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

                scanner = null;

            }
        )

        .catch(
            error => {

                console.log(
                    "Scanner stop error:",
                    error
                );

                scanner = null;

            }
        );

}


// ==========================================
// ACCEPT PAYMENT NOTIFICATION
// ==========================================

function acceptNotification() {

    if (
        !currentPayment ||
        !currentReceiver
    ) {

        showScreen(
            "home"
        );

        return;

    }


    const payment =
        currentPayment;


    // ======================================
    // MOCK RECEIVING
    // ======================================

    balance +=
        Number(
            payment.amount
        );


    localStorage.setItem(
        "quickpay_balance",
        balance
    );


    // ======================================
    // SHOW SUCCESS
    // ======================================

    document.getElementById(
        "successAmount"
    ).textContent =
        Number(
            payment.amount
        ).toLocaleString();


    document.getElementById(
        "successProvider"
    ).textContent =
        payment.provider;


    document.getElementById(
        "successTransaction"
    ).textContent =
        payment.transactionID;


    showToast(
        "Payment confirmed",
        `MWK ${Number(payment.amount).toLocaleString()} added to your demo balance.`
    );


    // Clear transaction
    currentPayment = null;

    currentReceiver = null;


    // ======================================
    // GO HOME DIRECTLY
    // ======================================

    setTimeout(
        () => {

            showScreen(
                "home"
            );

        },
        800
    );

}


// ==========================================
// BALANCE
// ==========================================

function loadBalance() {

    const savedBalance =
        localStorage.getItem(
            "quickpay_balance"
        );


    if (
        savedBalance !== null
    ) {

        balance =
            Number(
                savedBalance
            );

    }


    document.getElementById(
        "balance"
    ).textContent =
        balance.toLocaleString();

}


// ==========================================
// MASK ACCOUNT
// ==========================================

function maskAccount(
    account
) {

    if (!account) {

        return "";

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
// HTML ESCAPING
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
// TOAST NOTIFICATION
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
