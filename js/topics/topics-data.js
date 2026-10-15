(() => {
    const expectedTopicIds = [
    "kitchen",
    "adjectives",
    "feelings",
    "house",
    "bathroom",
    "bedroom",
    "livingRoom",
    "body",
    "summerClothes",
    "winterClothes",
    "transitionalClothes",
    "airport",
    "linkingWords"
];
    const topicParts = window.ENL_TOPIC_DATA_PARTS || {};
    const missingTopicIds = expectedTopicIds.filter((id) => !Object.prototype.hasOwnProperty.call(topicParts, id));

    if (missingTopicIds.length > 0) {
        throw new Error(`Topic data is missing: ${missingTopicIds.join(', ')}`);
    }

    window.TOPICS_DATA = Object.freeze(Object.fromEntries(
        expectedTopicIds.map((id) => [id, topicParts[id]])
    ));
    delete window.ENL_TOPIC_DATA_PARTS;
})();
