// Numbers quiz data and number-pool generation.

window.EnglishNextLevelNumbersData = (() => {
    // ============================================
    // 2. GAME DATA
    // ============================================

    const gameData = {
        numbers: [
            { value: 1, word: 'one' }, { value: 2, word: 'two' }, { value: 3, word: 'three' },
            { value: 4, word: 'four' }, { value: 5, word: 'five' }, { value: 6, word: 'six' },
            { value: 7, word: 'seven' }, { value: 8, word: 'eight' }, { value: 9, word: 'nine' },
            { value: 10, word: 'ten' }
        ],
        numbers11_20: [
            { value: 11, word: 'eleven' }, { value: 12, word: 'twelve' }, { value: 13, word: 'thirteen' },
            { value: 14, word: 'fourteen' }, { value: 15, word: 'fifteen' }, { value: 16, word: 'sixteen' },
            { value: 17, word: 'seventeen' }, { value: 18, word: 'eighteen' }, { value: 19, word: 'nineteen' },
            { value: 20, word: 'twenty' }
        ],
        tens: [
            { value: 20, word: 'twenty' }, { value: 30, word: 'thirty' }, { value: 40, word: 'forty' },
            { value: 50, word: 'fifty' }, { value: 60, word: 'sixty' }, { value: 70, word: 'seventy' },
            { value: 80, word: 'eighty' }, { value: 90, word: 'ninety' }
        ],
        hundreds: [
            { value: 100, word: 'one hundred' }, { value: 200, word: 'two hundred' },
            { value: 300, word: 'three hundred' }, { value: 400, word: 'four hundred' },
            { value: 500, word: 'five hundred' }, { value: 600, word: 'six hundred' },
            { value: 700, word: 'seven hundred' }, { value: 800, word: 'eight hundred' },
            { value: 900, word: 'nine hundred' }
        ],
        thousands: [
            { value: 1000, word: 'one thousand' }, { value: 2000, word: 'two thousand' },
            { value: 3000, word: 'three thousand' }, { value: 4000, word: 'four thousand' },
            { value: 5000, word: 'five thousand' }, { value: 6000, word: 'six thousand' },
            { value: 7000, word: 'seven thousand' }, { value: 8000, word: 'eight thousand' },
            { value: 9000, word: 'nine thousand' }
        ],
        random21_99: [],
        random101_999: [],
        random1001_9999: [],
        mixedAdvanced: []
    };

    // ============================================
    // FUNÇÕES GERADORAS DE NÚMEROS
    // ============================================

    function generateNumbers_21_99() {
        const numbers = [];
        const units = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
        const tens = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

        for (let t = 0; t < tens.length; t++) {
            for (let u = 0; u < units.length; u++) {
                numbers.push({
                    value: (t + 2) * 10 + (u + 1),
                    word: `${tens[t]}-${units[u]}`
                });
            }
        }
        return numbers;
    }

    function generateNumbers_101_999() {
        const numbers = [];
        const hundreds = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
        const units = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
        const tensList = ['ten', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
        const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
                       'sixteen', 'seventeen', 'eighteen', 'nineteen'];

        for (let h = 0; h < hundreds.length; h++) {
            const hundredWord = `${hundreds[h]} hundred`;
            numbers.push({ value: (h + 1) * 100, word: hundredWord });

            for (let u = 0; u < units.length; u++) {
                numbers.push({ value: (h + 1) * 100 + (u + 1), word: `${hundredWord} ${units[u]}` });
            }

            for (let s = 0; s < teens.length; s++) {
                numbers.push({ value: (h + 1) * 100 + 10 + s, word: `${hundredWord} ${teens[s]}` });
            }

            for (let t = 0; t < tensList.length; t++) {
                const tenWord = tensList[t];
                const tenValue = (t + 1) * 10;
                if (tenValue >= 20) {
                    numbers.push({ value: (h + 1) * 100 + tenValue, word: `${hundredWord} ${tenWord}` });
                }
                for (let u = 0; u < units.length; u++) {
                    numbers.push({ value: (h + 1) * 100 + tenValue + (u + 1), word: `${hundredWord} ${tenWord}-${units[u]}` });
                }
            }
        }

        const unique = [];
        const seen = new Set();
        for (const num of numbers) {
            if (!seen.has(num.value)) {
                seen.add(num.value);
                unique.push(num);
            }
        }
        return unique;
    }

    function generateNumbers_1001_9999() {
        const numbers = [];
        const thousands = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
        const hundreds = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
        const tensList = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
        const units = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
        const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
                       'sixteen', 'seventeen', 'eighteen', 'nineteen'];

        for (let th = 0; th < thousands.length; th++) {
            const thousandWord = `${thousands[th]} thousand`;
            const thousandValue = (th + 1) * 1000;

            if (thousandValue > 1000) {
                numbers.push({ value: thousandValue, word: thousandWord });
            }

            for (let u = 0; u < units.length; u++) {
                numbers.push({ value: thousandValue + (u + 1), word: `${thousandWord} ${units[u]}` });
            }

            for (let s = 0; s < teens.length; s++) {
                numbers.push({ value: thousandValue + 10 + s, word: `${thousandWord} ${teens[s]}` });
            }

            for (let t = 0; t < tensList.length; t++) {
                const tenWord = tensList[t];
                const tenValue = (t + 2) * 10;
                numbers.push({ value: thousandValue + tenValue, word: `${thousandWord} ${tenWord}` });
                for (let u = 0; u < units.length; u++) {
                    numbers.push({ value: thousandValue + tenValue + (u + 1), word: `${thousandWord} ${tenWord}-${units[u]}` });
                }
            }

            for (let h = 0; h < hundreds.length; h++) {
                const hundredWord = `${hundreds[h]} hundred`;
                const hundredValue = (h + 1) * 100;
                numbers.push({ value: thousandValue + hundredValue, word: `${thousandWord} ${hundredWord}` });

                for (let u = 0; u < units.length; u++) {
                    numbers.push({ value: thousandValue + hundredValue + (u + 1), word: `${thousandWord} ${hundredWord} ${units[u]}` });
                }

                for (let s = 0; s < teens.length; s++) {
                    numbers.push({ value: thousandValue + hundredValue + 10 + s, word: `${thousandWord} ${hundredWord} ${teens[s]}` });
                }

                for (let t = 0; t < tensList.length; t++) {
                    const tenWord = tensList[t];
                    const tenValue = (t + 2) * 10;
                    numbers.push({ value: thousandValue + hundredValue + tenValue, word: `${thousandWord} ${hundredWord} ${tenWord}` });
                    for (let u = 0; u < units.length; u++) {
                        numbers.push({ value: thousandValue + hundredValue + tenValue + (u + 1), word: `${thousandWord} ${hundredWord} ${tenWord}-${units[u]}` });
                    }
                }
            }
        }

        const unique = [];
        const seen = new Set();
        for (const num of numbers) {
            if (!seen.has(num.value)) {
                seen.add(num.value);
                unique.push(num);
            }
        }
        return unique;
    }

    function getMixedAdvancedPool() {
        const allNumbers = [
            ...gameData.numbers,
            ...gameData.numbers11_20,
            ...gameData.tens,
            ...gameData.hundreds,
            ...gameData.thousands,
            ...gameData.random21_99,
            ...gameData.random101_999,
            ...gameData.random1001_9999
        ];

        const seenValues = new Set();
        return allNumbers.filter((number) => {
            if (seenValues.has(number.value)) return false;
            seenValues.add(number.value);
            return true;
        });
    }

    function generateMixedAdvanced() {
        const uniqueNumbers = getMixedAdvancedPool();
        for (let i = uniqueNumbers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [uniqueNumbers[i], uniqueNumbers[j]] = [uniqueNumbers[j], uniqueNumbers[i]];
        }

        return uniqueNumbers.slice(0, 50);
    }

    // ============================================
    // PREENCHER OS DADOS GERADOS
    // ============================================

    gameData.random21_99 = generateNumbers_21_99();
    gameData.random101_999 = generateNumbers_101_999();
    gameData.random1001_9999 = generateNumbers_1001_9999();
    gameData.mixedAdvanced = generateMixedAdvanced();

    window.enlDebug?.('Game data loaded:');
    window.enlDebug?.('21-99:', gameData.random21_99.length, 'numbers');
    window.enlDebug?.('101-999:', gameData.random101_999.length, 'numbers');
    window.enlDebug?.('1001-9999:', gameData.random1001_9999.length, 'numbers');
    window.enlDebug?.('Mixed Advanced:', gameData.mixedAdvanced.length, 'numbers');

    return Object.freeze({ gameData, getMixedAdvancedPool });
})();
