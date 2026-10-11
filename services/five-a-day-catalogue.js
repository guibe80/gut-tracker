const FIVE_A_DAY_CATALOGUE = [
    { id: 'apple', name: 'Apple', category: 'fruit', guidance: '1 medium apple is about 1 portion (80g)', defaultQuantity: 80, unit: 'g' },
    { id: 'banana', name: 'Banana', category: 'fruit', guidance: '1 medium banana is about 1 portion (80g)', defaultQuantity: 80, unit: 'g' },
    { id: 'orange', name: 'Orange', category: 'fruit', guidance: '1 medium orange is about 1 portion (80g)', defaultQuantity: 80, unit: 'g' },
    { id: 'strawberries', name: 'Strawberries', category: 'fruit', guidance: 'About 7 strawberries is 1 portion (80g)', defaultQuantity: 80, unit: 'g' },
    { id: 'blueberries', name: 'Blueberries', category: 'fruit', guidance: 'Use the amount eaten; 80g is 1 portion', defaultQuantity: 80, unit: 'g' },
    { id: 'dried-apricots', name: 'Dried apricots', category: 'dried_fruit', guidance: 'About 3 dried apricots is 1 portion (30g)', defaultQuantity: 30, unit: 'g' },
    { id: 'carrot', name: 'Carrot', category: 'vegetable', guidance: 'Use the amount eaten; 80g is 1 portion', defaultQuantity: 80, unit: 'g' },
    { id: 'broccoli', name: 'Broccoli', category: 'vegetable', guidance: 'About 2 spears is 1 portion (80g)', defaultQuantity: 80, unit: 'g' },
    { id: 'spinach', name: 'Spinach', category: 'vegetable', guidance: 'Use the amount eaten; 80g is 1 portion', defaultQuantity: 80, unit: 'g' },
    { id: 'tomato', name: 'Tomato', category: 'vegetable', guidance: '1 medium tomato is about 1 portion (80g)', defaultQuantity: 80, unit: 'g' },
    { id: 'peas', name: 'Peas', category: 'vegetable', guidance: 'Use the amount eaten; 80g is 1 portion', defaultQuantity: 80, unit: 'g' },
    { id: 'kidney-beans', name: 'Kidney beans', category: 'beans_pulses', guidance: 'Beans and pulses together count as at most 1 portion a day', defaultQuantity: 80, unit: 'g' },
    { id: 'chickpeas', name: 'Chickpeas', category: 'beans_pulses', guidance: 'Beans and pulses together count as at most 1 portion a day', defaultQuantity: 80, unit: 'g' },
    { id: 'orange-juice', name: '100% orange juice', category: 'juice_smoothie', guidance: 'Juice and smoothies together count as at most 1 portion (150ml) a day', defaultQuantity: 150, unit: 'ml' },
    { id: 'fruit-smoothie', name: 'Fruit smoothie', category: 'juice_smoothie', guidance: 'Juice and smoothies together count as at most 1 portion (150ml) a day', defaultQuantity: 150, unit: 'ml' },
    { id: 'potato', name: 'Potato', category: 'excluded', guidance: 'Potatoes do not count towards 5 A Day', defaultQuantity: 150, unit: 'g' },
    { id: 'sweet-potato', name: 'Sweet potato', category: 'excluded', guidance: 'Sweet potatoes do not count towards 5 A Day', defaultQuantity: 150, unit: 'g' },
    { id: 'cassava', name: 'Cassava', category: 'excluded', guidance: 'Cassava does not count towards 5 A Day', defaultQuantity: 150, unit: 'g' },
    { id: 'yam', name: 'Yam', category: 'excluded', guidance: 'Yams do not count towards 5 A Day', defaultQuantity: 150, unit: 'g' },
    { id: 'plantain', name: 'Plantain', category: 'excluded', guidance: 'Plantain does not count towards 5 A Day', defaultQuantity: 150, unit: 'g' },
];

function searchFiveADayCatalogue(query = '') {
    const search = String(query).trim().toLocaleLowerCase('en-GB');
    if (!search) return FIVE_A_DAY_CATALOGUE.slice();
    return FIVE_A_DAY_CATALOGUE.filter(food => food.name.toLocaleLowerCase('en-GB').includes(search));
}

function findFiveADayCatalogueItem(name) {
    const normalized = String(name || '').trim().toLocaleLowerCase('en-GB');
    return FIVE_A_DAY_CATALOGUE.find(food => food.name.toLocaleLowerCase('en-GB') === normalized) || null;
}
