const TelegramBot = require('node-telegram-bot-api');
const request = require('request');
const moment = require('moment');
const bot = new TelegramBot('6173657115:AAHBi9spJsHSwtV1zh-_lgp32tzBj0A_sBQ', { polling: true });


let departurePoint = {};
let arrivalPoint = {};
let dateOfJourney = '';
let listOfDepCities = [];
let listOfArrCities = [];
let observerLog = '';
let observerCounter = 0;
let observerSuccessCounter = 0;
let observerStartTime = '';

let phase = null;

const createMonitorOptions = {
	reply_markup: {
		inline_keyboard: [
			[{ text: 'Yes', callback_data: '1' }],
			[{ text: 'No', callback_data: '0' }],
		]
	}
}
const startBot = (chatId) => {
	phase = 'departure';
	bot.sendMessage(chatId, 'Привіт👋 Я допоможу тобі знайти квитки на потяг🚆');
	setTimeout(() => {
		departure(chatId);
	}, 1500);

};

const departure = (chatId) => {
	bot.sendMessage(chatId, '⬇️⬇️⬇️Введіть пункт відправлення⬇️⬇️⬇️');
	bot.on('message', async (msg) => {
		if (phase == 'departure') {
			const messageText = msg.text;
			listOfDepCities = await getCity(messageText);
			const options = createButtonsMarkup(listOfDepCities);
			bot.sendMessage(chatId, '⬇️⬇️⬇️Обери пункт відправлення⬇️⬇️⬇️', options);
		}
	})
	bot.on('callback_query', (query) => {
		if (phase == 'departure') {
			const optionSelected = query.data;
			departurePoint.id = optionSelected;
			departurePoint.name = findNameOfCityByValue(optionSelected, listOfDepCities);
			bot.sendMessage(chatId, `Вогонь🔥 Твій пункт відправлення - 🏘${departurePoint.name}`);
			setTimeout(() => {
				arrival(chatId);
			}, 1500);
		}
	})
}
const arrival = (chatId) => {
	bot.sendMessage(chatId, '⬇️⬇️⬇️Введить пункт прибуття⬇️⬇️⬇️');
	phase = 'arrival';
	bot.on('message', async (msg) => {
		if (phase == 'arrival') {
			const messageText = msg.text;
			listOfArrCities = await getCity(messageText);
			const options = createButtonsMarkup(listOfArrCities);
			bot.sendMessage(chatId, '⬇️⬇️⬇️Оберить пункт прибуття⬇️⬇️⬇️', options);
		}
	})
	bot.on('callback_query', (query) => {
		if (phase == 'arrival') {
			const optionSelected = query.data;
			arrivalPoint.id = optionSelected;
			arrivalPoint.name = findNameOfCityByValue(optionSelected, listOfArrCities);
			bot.sendMessage(chatId, `Супер💫 Пункт відправлення - 🏘${departurePoint.name} та пункт прибуття - 🏘${arrivalPoint.name}`);
			setTimeout(() => {
				date(chatId);
			}, 1000)
		}
	})
}

const date = (chatId) => {
	phase = 'date';
	const dates = generateDates()
	const dateOptions = {
		reply_markup: {
			inline_keyboard: dates,
		}
	};

	bot.sendMessage(chatId, `⬇️⬇️⬇️Тепер давай оберемо дату подорожі⬇️⬇️⬇️`, dateOptions);
	bot.on('callback_query', async (query) => {
		if (phase == 'date') {
			const optionSelected = query.data;
			dateOfJourney = optionSelected;

			bot.sendMessage(chatId, `Чудово✨ Точка відправлення 🏘${departurePoint.name} та точка прибуття 🏘${arrivalPoint.name} 🗓${dateOfJourney}`);
			searchTickets(chatId);
		}
	})
}

const searchTickets = async (chatId) => {
	phase = 'searchTickets';

	try {
		const listOfTrains = await getTrains();
		if (listOfTrains?.errorCode) {
			bot.sendMessage(chatId, `Немає вільних квитків з 🏘${departurePoint.name} до 🏘${arrivalPoint.name} 🗓${dateOfJourney}`);
			setTimeout(() => {
				bot.sendMessage(chatId, `Створити мониторінг квитків? `, createMonitorOptions);
				phase = 'monitorTickets';
				bot.on('callback_query', async (query) => {
					if (phase == 'monitorTickets') {
						const optionSelected = query.data;
						if (+optionSelected) {
							createObserver(chatId)
						} else {
							phase = null;
						}
					}
				})

			}, 1000);
		} else {
			showAvailableTrains(listOfTrains, chatId);
		}
	} catch (error) {
		bot.sendMessage(chatId, `Помилка в запиті: ${error.message}`);
	}
}

bot.onText(/\/start/, (msg) => {
	const chatId = msg.chat.id;
	startBot(chatId);
});
bot.onText(/\/status/, (msg) => {
	const chatId = msg.chat.id;
	if (!observerStartTime) {
		bot.sendMessage(chatId,
			` Пошук квитків🎫 не починався`);
	} else {
		bot.sendMessage(chatId,
			`Статус пошука квитків🎫:
	Пошук почався о ${observerStartTime}
	Всього було спроб знайти квитки: ${observerCounter}
	З них успішних: ${observerSuccessCounter}
	`);
	}

});

function findNameOfCityByValue(id, list) {
	return list.find(o => o.id == id)?.name
}

function createObserver(chatId) {
	bot.sendMessage(chatId, `Я стоврив моніторінг🖥 за квитками по твоїм параметрам. Як тільки квитки зʼявляться - я напишу тобі про це🙃`);
	observerStartTime = moment().format('HH:MM DD.MM.YYYY')
	const lookForTickets = async () => {
		try {
			const listOfTrains = await getTrains();
			if (listOfTrains?.errorCode) {
				observerLog += `
				Немає вільних квитків з 🏘${departurePoint.name} до 🏘${arrivalPoint.name} 🗓${dateOfJourney}
				`
				observerCounter++;
				// bot.sendMessage(chatId, `Немає вільних квитків з 🏘${departurePoint.name} до 🏘${arrivalPoint.name} 🗓${dateOfJourney}`);
			} else {
				observerSuccessCounter++;
				showAvailableTrains(listOfTrains, chatId);
				clearInterval(int)
			}
		} catch (error) {
			bot.sendMessage(chatId, `Помилка в запиті: ${error.message}`);
		}

	}
	lookForTickets();
	const int = setInterval(lookForTickets, 60000);
}

function showAvailableTrains(listOfTrains, chatId) {
	bot.sendMessage(chatId, `Зараз будуть варіанти потягів:`);
	let availableTrains = '';

	listOfTrains.trips.forEach(o => {
		availableTrains += `🚅 Потяг номер ${o.legs[0].transInfo.number} 
		🌆 Прямує з ${o.legs[0].departureStation.name} до ${o.legs[0].arrivalStation.name} 
		🕘 Рушає ${o.legs[0].departureStation.departureDate} о ${o.legs[0].departureStation.departureTime} та прибуває ${o.legs[0].arrivalStation.arrivalDate} о ${o.legs[0].arrivalStation.arrivalTime}.
		
		🎫 Варіанти квитків в наявності:
		${getAvailableClassesOfSeats(o.legs[0].wagonTypes)} 
		
		____________________________________________________


		`
	})
	bot.sendMessage(chatId, availableTrains);
	phase = null;
}

function getAvailableClassesOfSeats(wagonTypes) {
	let stringType = ''
	wagonTypes.forEach(wagon => {
		stringType += `
		💺 ${wagon.name}: ${wagon.availableSeats} штук. 
		💵 Мінимальна ціна - ${wagon.minPrice}. Максимальна ціна - ${wagon.maxPrice}
		`
	})
	return stringType
}

function getTrains() {
	const BASE_URL = 'https://de-prod-lb.cashalot.in.ua/rest/supplier/search';
	const options = {
		url: BASE_URL,
		method: 'POST',
		json: true,
		body: {
			arrivalCode: arrivalPoint.id,
			departureCode: departurePoint.id,
			departureDate: dateOfJourney,
			language: "uk",
			requestId: "90adde2bbb92",
			sessionId: "f1234c0900d9",
			sourceType: "FRONTEND",
			supplier: "uz_train",
			transactionId: "02bcfe1e7c10",
			userId: "f47b46ad415f",
		}
	};
	return new Promise(function (resolve, reject) {
		request(options, (error, response) => {
			if (error) {
				reject(error);
				return;
			}
			const res = response.toJSON();
			if (response.statusCode === 200) {
				resolve(res.body)
			} else {
				reject(new Error(`API request failed with status code: ${response.statusCode}`));
			}
		});
	}).catch(error => {
		console.error(error);
	});
}

async function getCity(query) {
	const BASE_URL = 'https://de-prod-lb.cashalot.in.ua/rest/stations/express';
	const options = {
		url: BASE_URL,
		method: 'POST',
		json: true,
		body: {
			language: "uk",
			supplier: "uz_train",
			requestId: "ab158a7d7499",
			transactionId: "656468a62c39",
			sessionId: "ed7a2931972b",
			userId: "f47b46ad415f",
			sourceType: "FRONTEND",
			query
		}
	};
	return new Promise(function (resolve, reject) {
		request(options, (error, response) => {
			if (error) {
				reject(error);
				return;
			}
			const res = response.toJSON();
			if (response.statusCode === 200) {
				resolve(res.body.cities)
			} else {
				reject(new Error(`API request failed with status code: ${response.statusCode}`));
			}
		});
	}).catch(error => {
		console.error(error);
	});
	// const BASE_URL = 'https://booking.uz.gov.ua/train_search/station/?term=';
	// const WEBSITE_URL = BASE_URL + encodeURIComponent(query);

	// const options = {
	// 	url: WEBSITE_URL,
	// };

	// return new Promise(function (resolve, reject) {
	// 	request.get(options, (error, response) => {
	// 		const res = response.toJSON();
	// 		if (!error && response.statusCode === 200) {
	// 			resolve(res.body)
	// 		} else {
	// 			reject(error)
	// 		}
	// 	});
	// }).catch(error => {
	// 	console.error('error', error);
	// });
}

function createButtonsMarkup(data) {
	const formattedData = data.map(station => [
		{ text: station.name, callback_data: station.id.toString() }
	])

	const options = {
		reply_markup: {
			inline_keyboard: formattedData,
		}
	};
	return options
}

function generateDates() {
	const arr = [];
	for (let index = 0; index < 25; index++) {
		const date = moment().add(index, 'd')
		arr.push([{ text: date.format('DD.MM.YYYY - dddd'), callback_data: date.format('YYYY-MM-DD') }])
	}
	return arr
}