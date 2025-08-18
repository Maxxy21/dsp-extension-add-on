// ==UserScript==
// @name         AMZL Visibility Addon
// @namespace    antmarce@amazon.com
// @version      1.0
// @description  Visibility enhancements for AMZL sites
// @author       @traand
// @match        https://logistics.amazon.co.uk/internal/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @downloadURL  https://drive.corp.amazon.com/view/traand@/scripts/amzlVis.user.js
// @updateURL    https://drive.corp.amazon.com/view/traand@/scripts/amzlVis.user.js
// ==/UserScript==

// Wiki link: https://w.amazon.com/bin/view/Traand/amzlvis/

// Features:
// Adds summary tables for DSP and flex acceptance

// Changelog:
// v0.1 initial script
// v0.2 added DSP summary
// v0.3 fix for accepted not rostered and vice versa
// v0.4 splitting DSP demand by cycle/rescue
// v0.5 fix sort by wave time
// v0.6 fix json parse
// v0.7 fix sort by wave time for specific Cycle's
// 28.11.21 - updated MEUArea IDs

// get current site url (host part)
const CURRENT_SITE = document.location.host;

(function () {
    'use strict';

    switch (CURRENT_SITE) {
        case "logistics.amazon.co.uk":
            {
                const PATHNAME = document.location.pathname;

                switch (PATHNAME) {
                    // scheduling UI
                    case "/internal/scheduling/dsps": {
                        console.log("Inside Scheduling UI");
                        // mutation observer to watch scheduling table
                        let observer = new MutationObserver(function () {
                            if (document.getElementById("schedulingTable").attributes.style.value === "") {
                                console.log("Scheduling table has appeared.");

                                if (!document.getElementById("flexTableButton")) {
                                    // add button to refresh data
                                    let button = document.createElement("a");
                                    button.innerHTML = "Refresh Demand Tables";
                                    button.setAttribute("class", "typeFive button ajaxButton");
                                    button.id = "flexTableButton";
                                    document.getElementById("schedulingSearchbar").append(button);
                                    button.addEventListener("click", function (event) {
                                        // event.preventDefault();
                                        getDemand();
                                    });
                                }
                                getDemand();
                            }
                        });
                        observer.observe(document.getElementById("schedulingTable"), { attributes: true });

                        // add css styles
                        // change table-layout to fixed, maybe?
                        GM_addStyle("#mainFlexTable div { display: inline-block; margin-bottom: 15px; margin-left: 15px; margin-right: 15px}\
                                    #mainFlexTable h1 { margin: 0; color: #213340}\
                                    #mainFlexTable table tr { text-align: center; border-bottom: 1px solid #ddd }\
                                    #mainFlexTable table td { text-align: center; border-bottom: 1px solid #ddd }\
                                    #mainFlexTable table { table-layout: auto; width: 450px }\
                                    #mainFlexTable tbody tr:hover { background-color: #f5f5f5 }\
                                    #mainFlexTable tr:nth-child(even) { background-color: #f2f2f2 }\
                                    #mainFlexTable th { text-align: center; border-bottom: 1px solid #000000 }\
                                    #mainFlexTable { margin-left: 30px }\
                                    .subDSPtable > table > tbody > tr:last-child { font-weight: bold }");
                        break;
                    }
                    // capacity rosterview
                    case "/internal/capacity/rosterview": {
                        console.log("Inside roster view");
                        // mutation observer to watch DP table
                        let observer = new MutationObserver(function () {
                            let queryString = window.location.search;
                            let urlParams = new URLSearchParams(queryString);
                            if (document.getElementById("DATable").attributes.style.value === "" && urlParams.get('serviceAreaId') == '7f327d2c-cc01-4f82-89ff-61f731625628') {
                                addDexterLinks();
                            }
                        });
                        observer.observe(document.getElementById("DATable"), { attributes: true });

                        // add button to toggle active DPs
                        let button = document.createElement("a");
                        button.innerHTML = "Toggle Active";
                        button.setAttribute("class", "typeFive button ajaxButton");
                        button.style = "margin-bottom: -10px"
                        var switched = 0;
                        button.addEventListener("click", function () {
                            if (switched == 0) {
                                document.querySelectorAll('#cspDATable td[data-bind="text: availability"]').forEach(function (availability) {
                                    if (availability.innerHTML == "Active") {
                                        availability.parentNode.style.display = "none";
                                    }
                                });
                                switched = 1;
                            }
                            else {
                                document.querySelectorAll('td[data-bind="text: availability"]').forEach(function (availability) {
                                    availability.parentNode.style.display = "";
                                });
                                switched = 0;
                            }
                        });
                        document.getElementById("searchbar-tags").appendChild(button);

                        break;
                    }
                }
            }
            break;
    }
})();

// adds Dexter link to DP table
// WIP: implement for other regions
function addDexterLinks() {
    console.log("Adding Dexter links");
    // get and format current date
    let urlParams = new URLSearchParams(window.location.search);
    let date = new Date(urlParams.get('date').split("-")[1] + "/" + urlParams.get('date').split("-")[2] + "/" + urlParams.get('date').split("-")[0]);
    let DATESTRING = date.getTime();

    // currently only working for Austin region (DAU1,DAU2,UTX9, etc.)
    let REGIONID = 41

    // transform transporterIDs into links to dexter
    document.querySelectorAll('#cspDATable td[data-bind="text: transporterId"]').forEach(function (transporter) {
        let TRANSPORTERID = transporter.innerText;
        let dexURL = "https://logistics.amazon.co.uk/internal/network/package?type=ASSOCIATE&transporterId=" + TRANSPORTERID + "&region=" + REGIONID + "&date=" + DATESTRING + "&returnToStation=false"

        let dexLink = document.createElement("a");
        transporter.innerHTML = "<a class=\"af-link\" href=\"" + dexURL + "\" target=\"_blank\">" + TRANSPORTERID + "</a>"
    });
}

// fetch and parse flex acceptance
function getDemand() {
    // clear out existing table if it exists
    if (document.getElementById("mainFlexTable")) {
        document.getElementById("mainFlexTable").innerHTML = "";
    }

    // using url to set parameters for fetching provider data
    let urlParams = new URLSearchParams(window.location.search);
    let SERVICEAREAID = urlParams.get('serviceAreaId');
    let DATE = urlParams.get('date');
    let apirURL = "https://logistics.amazon.co.uk/internal/scheduling/dsps/api/getProviderInfo?serviceAreaId=" + SERVICEAREAID + "&providerDemandType=Forecast&date=" + DATE;
    const MEUAreaIDs = ["1e1c5772-f2d1-48f2-99a3-3e6f770f5015", "128a663f-6d6b-4d55-ba5e-3388609fc6dd", "128a663f-6d6b-4d55-ba5e-3388609fc6dd", "df216b97-c321-4391-af47-b4fe76b5a789", "3609ca6c-0716-4d82-b8e2-b48060f09329",
                        "28a575a7-4e51-438b-bb53-6225ebdd1d4a", "d546cb68-71c2-4e09-9b5d-61da5bcae64c", "df216b97-c321-4391-af47-b4fe76b5a789", "fbcaf416-2454-4345-887c-95cc8b157784", "29903471-0031-4888-bff9-480c881ee6b5",
                        "26392532-afec-4553-8dfa-273cb030dcb9", "26392532-afec-4553-8dfa-273cb030dcb9", "792f3e55-c706-4ea3-be31-efb5713704ae", "f6fe6aeb-44ea-4c54-9825-60b575d98fcd", "992e315b-9585-4ab7-8c57-7111f94b0d32",
                        "82943370-c021-4cb9-8e7e-ebef7c8bee3e", "1974239e-b45a-4c9d-ba4e-7fd383ab9db7", "bd4d40f0-4c4b-452f-a130-4ff8a0a89836", "47aabfcc-c964-42c6-993d-b9d7d57ceb44", "c1e21f42-b3a5-4aa3-a338-763099a4260a",
                        "a2038a4d-e39b-4b5f-aada-bce7d3923fd7", "b6460166-2987-41c4-a0bd-c220564237cc", "8b1cfb83-b6cc-4a99-ac6a-71608d6ac531", "890714a2-9129-4c12-ad56-a1b26bbf47e8", "cb8028c6-af99-4e6d-a7d0-85c157e48f86",
                        "cf144c46-1c56-44d3-b344-fcd32986b6d5", "6f9383b2-8fd6-461a-a677-e8eb5b972c73", "02ab0b3a-9910-494d-a410-460af4761cc9", "86020b89-6400-424b-a6fe-85bcf714a63e", "1a4a6ee9-8876-4f79-9c6d-e765f3799f08",
                        "e984cf34-94c2-4f19-be0a-c321d8b85978", "bd40aca3-9511-4c6f-a23b-1b5eec89f430", "aa376d29-ad2d-4d28-81fa-286232419d15", "46aac5e0-11ee-4d53-a7d6-a576d5dcdcf3", "aee3efdf-3d20-4ab1-ad34-3bc053551af0",
                        "425465b0-fa77-4fb0-91d3-c00fa826278d", "e45bf813-bb92-4517-87d8-589dda1774cc", "21bfeff7-7936-44a5-a633-514ec9888229", "06d53ac9-092b-4a89-afb7-30a6bb009b5d", "cd154569-5bac-4901-aa8a-bd8fa16a9491",
                        "7754da34-252e-4d0f-b650-a259ec1455cf", "a281fe58-af45-4aea-90a3-de6b15f420f0", "e02c0a3f-05ea-4bf1-b385-ad990fa396da", "c3e6862a-3842-4ba5-9610-7a5d528fdb0f", "df7c15f5-537e-4e80-8cdd-14afd39276f4",
                        "0510cce4-2e9b-4231-b7ac-261adc72a1d4", "908f1ca7-8565-4864-81a1-d444c1ce810e", "fa699551-05e9-47b8-8731-be8ce911f816", "882bdf34-d931-4c3f-a646-fb7d197007c0", "fed6e276-42fe-4ae2-bcb3-f5ce65db8962",
                        "024149df-fb37-4cdd-b077-23d7670dad88", "870f4c21-be6d-4288-9217-93cd47966146", "6e6fef73-2133-4887-9ac0-2b4d35d0058b", "2c6132d7-c37e-4ebc-a512-18fad031c449", "4bfd24c2-2c5a-4754-b9f9-be49237f497a",
                        "137b09f7-8125-40a2-96c3-7ab96152010b", "fda749ef-061b-4a56-8015-237c7e42911e", "de5698cb-690d-43f5-83bd-49deed383c3e", "2c611b11-c791-454d-a5fc-92fea8e7d92a", "8939eab3-7a7b-43fa-b256-7153da4d1edb",
                        "a7f896b1-5526-4934-ab59-e816df9f3a96", "c8c908f4-e1ef-4eb2-a342-ce5e39066906", "6731961f-e9b0-4fe3-92bf-805a09e5661e", "ad70bfe3-eb27-4f7d-b3f3-b1dff6df6c27", "42218bcb-1544-46a4-ab9c-65d01b3001e3",
                        "cf75c31c-7d86-4ef9-9348-b4037fa1896b", "7a4463f4-146d-42b0-b5c3-b9e59d39f2a1", "7d20e9a8-adfb-4cd8-afa4-7e0b964e32c1", "ed10c735-f115-4373-b840-8725c142983f", "c2df03ff-4328-4836-bb3b-e8fce176b230",
                        "1808d0b6-9cbb-4826-98d0-ccb94ce7c6e2", "79b18918-ed92-47f1-af33-59c03edab660", "63be45ed-28dd-41c9-a8ec-95c2ba00ce17", "029eb676-8ac9-4837-8acb-45bc178b6a18", "1232a82b-75be-43c0-a9b5-6f97c7437db2",
                        "1b11cd10-9e94-4da5-b501-f0ef0606434f", "1ce8968c-04af-47e0-a966-c12dabf5f6ca", "0212ff32-fb12-4174-ae52-c09bd63d91e2", "cf34d678-e350-49e8-ac0d-7b3cf8f0dbab", "b368b4f8-6a52-4aef-9869-fd76c8c09f18",
                        "a89d49f5-72f5-477a-af1e-715bc7dad33f", "cf44bf06-4e2b-400b-a8c8-b839b0d3b5c4", "78ec74a1-3d73-4e92-8139-0137faf8dd90", "6c5ee887-24e9-4ad1-89b8-c30b3d742f11", "098143e9-f682-4d27-8afa-676eb1879d4f",
                        "f135ceb8-26ce-4030-8733-646a14d7d5b5", "c15b7777-3306-457a-a8f3-8ea8bfe5dfc7", "baa4b443-9599-4b59-a3bc-b4ec9c0d5710", "dd5b05a0-1fc7-4cf1-a4d8-d5326b57be5f", "9ca991af-7d26-47d0-9e1a-0787d5b05330",
                        "083c372f-faf2-4f28-a145-887060bca3c9", "22ec22c9-203b-4739-94dc-b4e38e4a39ba", "5b4b978a-4b2b-4036-b2ba-c67dd3882afd", "1867a5d9-53ed-4a88-9a78-59b9c75ab9cc", "d2f0c987-c3b3-4b07-b1f6-520ed15b284b",
                        "b368b4f8-6a52-4aef-9869-fd76c8c09f18", "b81a6ab9-3876-42d3-9fc5-8785f7f55adc", "e398d832-a800-48d2-a0fc-81c92dee25c5", "5e4ed340-6016-478c-a451-4643d50bfeaa", "31d36bf8-0368-49a9-9a78-60e4a68499d5",
                        "e75ed4ac-379a-4c86-bd7d-a2e1d225512d", "4ea8d1ab-e172-4e0f-b57b-623c576ef2ca", "95c8b6eb-4d88-4fc2-8045-55201e16868f",]
    GM_xmlhttpRequest({
        method: "GET",
        url: apirURL,
        responseType: "json",
        onload: function (response) {
            console.log("Fetching service provider info.");

            let data = response.responseText;

            // chrome compatibility
            if (typeof(data) === 'string'){
                data = JSON.parse(data);
            };

            let parsedFlexData = new Array();
            let extractDspData = new Array();
            let parsedDspData = new Array();

            // parse out flex data from api
            for (let service in data) {
                if (data[service].serviceTypeName.includes("Flex")) {
                    data[service].providerDemandList.forEach(function (demand) {
                        if (MEUAreaIDs.includes(SERVICEAREAID)){
                        let parseTime = new Date(demand.startTime+3600*1000);
                        parsedFlexData.push({
                            serviceType: data[service].serviceTypeName,    // amflex large or amflex
                            waveType: demand.waveGroupId,   // cycle1, cycle2, sameday, rts
                            blockLength: demand.durationInMinutes / 60 + " hours",  // 5, 4.5, 4, 3.5, 3
                            startTime: parseTime.toLocaleTimeString().replace(/(:0{2} )/, " "), // eg 2:00 PM
                            scheduled: demand.scheduledQuantity,    // accepted demand
                            required: demand.requiredQuantity,  // required demand
                        });
                    }else{
                    let parseTime = new Date(demand.startTime);
                        parsedFlexData.push({
                            serviceType: data[service].serviceTypeName,    // amflex large or amflex
                            waveType: demand.waveGroupId,   // cycle1, cycle2, sameday, rts
                            blockLength: demand.durationInMinutes / 60 + " hours",  // 5, 4.5, 4, 3.5, 3
                            startTime: parseTime.toLocaleTimeString().replace(/(:0{2} )/, " "), // eg 2:00 PM
                            scheduled: demand.scheduledQuantity,    // accepted demand
                            required: demand.requiredQuantity,  // required demand
                        });
                    }
                    });
                }
            };

            // parse out dsp data from webpage
            let dspData = document.querySelectorAll(".providerRow");
            dspData.forEach(function (datarow) {
                // filter out for dsp row, filter out any with 0 accepted and 0 rostered
                if (datarow.children[3].className != "" && (datarow.children[7].innerText.trim() != "0" || datarow.children[8].innerText.trim() != "0")) {
                    let waveGroup = datarow.previousElementSibling
                    while (waveGroup.getElementsByClassName("dspWaveGroup").length == 0){
                        waveGroup = waveGroup.previousElementSibling
                    }

                    extractDspData.push({
                        dspName: datarow.children[3].innerText, // scoobeez, etc.
                        waveTime: datarow.children[4].innerText,    // 9:00 am
                        accepted: datarow.children[7].innerText.trim() * 1, // number of routes accepted
                        rostered: datarow.children[8].innerText.trim() * 1,  // number of routes rostered
                        waveType: waveGroup.getElementsByClassName("dspWaveGroup")[0].innerText // wave group
                    });
                }
            });

            // sort dsp data, by dsp and then wave time
            extractDspData.sort(function (a, b) {
            var timediff = new Date('1970/01/01 ' + a.waveTime) - new Date('1970/01/01 ' + b.waveTime);
            if (timediff > 0) {
                return 1;
            }
            else if (timediff < 0) {
                return -1;
            }
            else if (a.dspName < b.dspName) {
                return -1;
            }
            else if (a.dspName > b.dspName) {
                return 1;
            }
            else return 0;
        });

            // de-duplicate dsp data
            parsedDspData.push(extractDspData.reduce(function (acc, curr) {
                if (acc.dspName == curr.dspName && acc.waveTime == curr.waveTime && acc.waveType == curr.waveType) {
                    acc.accepted += curr.accepted;
                    acc.rostered += curr.rostered;
                }
                else {
                    parsedDspData.push(acc);
                    acc = curr;
                }
                return acc
            }));

            let flexWaveOrder = getWaveOrder(parsedFlexData, false);
            let dspWaveOrder = getWaveOrder(parsedDspData, true);
            buildTables(flexWaveOrder, parsedFlexData, dspWaveOrder, parsedDspData);
        }
    });
}

// sort parsed data to find order of waves
function getWaveOrder(data, alpha) {
    let waveOrder = new Array();
    data.sort(function (a, b) {
        if (a.startTime > b.startTime) return 1;
        if (a.startTime < b.startTime) return -1;
    })

    for (let wave in data) {
        if (!waveOrder.includes(data[wave].waveType)) {
            waveOrder.push(data[wave].waveType);
        }
    }

    if (alpha){
        return waveOrder.sort()
    }

    return waveOrder
}

// build and add tables for each service type
function buildTables(flexWaveOrder, flexData, dspWaveOrder, dspData) {
    let orderedFlex = new Array();
    for (let wave in flexWaveOrder) {
        let tempWave = flexData.filter(demand => demand.waveType == flexWaveOrder[wave]);
        tempWave.sort(function (a, b) {
            if (b.startTime < a.startTime) return 1;
            if (b.startTime > a.startTime) return -1;

            if (a.blockLength < b.blockLength) return -1;
            if (a.blockLength > b.blockLength) return 1;


        });
        orderedFlex[wave] = tempWave
    };

    // create table div
    let tableDiv = document.createElement("div");
    tableDiv.id = "mainFlexTable";
    document.getElementById("schedulingSearchbar").appendChild(tableDiv);

    // table headers
    let flexRowKeys = ["startTime", "blockLength", "scheduled", "required"];
    let flexRowHead = ["Time", "Block Length", "Accepted", "Required", "Status"];

    // iterate through flex data
    for (let wave in orderedFlex) {
        // table div
        let subTableDiv = document.createElement("div");
        // table title
        let subTitle = document.createElement("h1");
        // table
        let subTable = document.createElement("table");
        // totals per wave
        let waveScheduledAll = 0;
        let waveRequiredAll = 0;

        for (let demand in orderedFlex[wave]) {
            // insert table row
            let row = subTable.insertRow();
            flexRowKeys.forEach(function (key) {
                var text;
                if (orderedFlex[wave][demand]["serviceType"].includes("Large") && key == "blockLength") {
                    text = document.createTextNode(orderedFlex[wave][demand][key] + " - Large Van");
                }
                else {
                    text = document.createTextNode(orderedFlex[wave][demand][key]);
                }
                let cell = row.insertCell();
                cell.appendChild(text);
                if (key == "scheduled") { waveScheduledAll += orderedFlex[wave][demand][key] };
                if (key == "required") { waveRequiredAll += orderedFlex[wave][demand][key] };
            });

            // insert status cell
            let cell = row.insertCell();
            let delta = orderedFlex[wave][demand]["required"] - orderedFlex[wave][demand]["scheduled"];

            // delta > 0 - pending demand, delta < 0 - overbooked demand, delta == 0 - filled
            if (delta > 0) {
                let text = document.createTextNode("Pending: " + delta);
                cell.appendChild(text);
            }
            else if (delta < 0) {
                let text = document.createTextNode("OB: " + Math.abs(delta));
                cell.appendChild(text);
            }
            else {
                let text = document.createTextNode("Filled");
                cell.appendChild(text);
            }
        };

        // update header with total wave acceptance
        subTitle.innerText = orderedFlex[wave][0]["waveType"] + " - " + waveScheduledAll + "/" + waveRequiredAll;

        // insert table header
        let thead = subTable.createTHead();
        let row = thead.insertRow();
        flexRowHead.forEach(function (head) {
            let th = document.createElement("th");
            let text = document.createTextNode(head);
            th.appendChild(text);
            row.appendChild(th);
        })

        // attach table title and table to page
        subTableDiv.appendChild(subTitle);
        subTableDiv.appendChild(subTable);
        document.getElementById("mainFlexTable").appendChild(subTableDiv);
    };

    // dsp data
    let subTableDiv = document.createElement("div");
    let subTitle = document.createElement("h1");
    let subTable = document.createElement("table");

    let dspRowKeys = ["dspName", "waveTime", "accepted", "rostered"];
    let dspRowHead = ["DSP", "Wave", "Accepted", "Rostered"];

    subTitle.innerText = "DSP Summary";

    for (let wave in dspData) {
        let row = subTable.insertRow();
        dspRowKeys.forEach(function (key) {
            let text = document.createTextNode(dspData[wave][key]);
            let cell = row.insertCell();
            cell.appendChild(text);
        });
    };

    let dspthead = subTable.createTHead();
    let dsprow = dspthead.insertRow();
    dspRowHead.forEach(function (head) {
        let th = document.createElement("th");
        let text = document.createTextNode(head);
        th.appendChild(text);
        dsprow.appendChild(th);
    });

    subTableDiv.appendChild(subTitle);
    subTableDiv.appendChild(subTable);
    document.getElementById("mainFlexTable").appendChild(subTableDiv);

    dspWaveOrder.forEach(function(wavetitle){
        let filteredDspData = dspData.filter(demand => demand.waveType == wavetitle);
        buildDSPtable(filteredDspData);
    })

};

function buildDSPtable(groupData){
        // dsp data
        let subTableDiv = document.createElement("div");
        let subTitle = document.createElement("h1");
        let subTable = document.createElement("table");

        let dspRowKeys = ["dspName", "waveTime", "accepted", "rostered"];
        let dspRowHead = ["DSP", "Wave", "Accepted", "Rostered"];

        let totalAccepted = 0;
        let totalRostered = 0;

        if (groupData[0].waveType == "SAME_DAY"){
            subTitle.innerText = "DSP Summary (DSP Initiated Work)";
        }
        else {
            subTitle.innerText = "DSP Summary (" + groupData[0].waveType + ")";
            groupData.sort(function (a, b) {
            var timediff = new Date('1970/01/01 ' + a.waveTime) - new Date('1970/01/01 ' + b.waveTime);
            if (timediff > 0) {
                return 1;
            }
            else if (timediff < 0) {
                return -1;
            }
            else if (a.dspName < b.dspName) {
                return -1;
            }
            else if (a.dspName > b.dspName) {
                return 1;
            }
            else return 0;
        })
        }

        for (let wave in groupData) {
            let row = subTable.insertRow();
            dspRowKeys.forEach(function (key) {
                let text = document.createTextNode(groupData[wave][key]);
                let cell = row.insertCell();
                cell.appendChild(text);
            });
            totalAccepted += groupData[wave].accepted;
            totalRostered += groupData[wave].rostered;
        };

        // add total row
        let totalRow = ["", "Total", totalAccepted, totalRostered];
        let tablerow = subTable.insertRow();
        totalRow.forEach(function(item){
            let totaltext = document.createTextNode(item);
            let totalcell = tablerow.insertCell();
            totalcell.appendChild(totaltext);
        });


        let dspthead = subTable.createTHead();
        let dsprow = dspthead.insertRow();
        dspRowHead.forEach(function (head) {
            let th = document.createElement("th");
            let text = document.createTextNode(head);
            th.appendChild(text);
            dsprow.appendChild(th);
        });

        subTableDiv.appendChild(subTitle);
        subTableDiv.appendChild(subTable);
        subTableDiv.setAttribute("class", "subDSPtable");
        document.getElementById("mainFlexTable").appendChild(subTableDiv);
}
