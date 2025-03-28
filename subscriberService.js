// subscriberService.js
const subscribers = new Set();

function addSubscriber(chatId) {
  subscribers.add(chatId);
}

function removeSubscriber(chatId) {
  subscribers.delete(chatId);
}

function getSubscribers() {
  return Array.from(subscribers);
}

module.exports = {
  addSubscriber,
  removeSubscriber,
  getSubscribers
};
