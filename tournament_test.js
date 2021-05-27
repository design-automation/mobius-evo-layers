const population = 10;
const liveDesignList = [];
const deadDesignList = [];

for (let i = 0; i< population * 2; i++) {
    liveDesignList.push({
        genID: i,
        score: Math.random() * 100
    })
}

const tournament_size = 6;
const liveDesignTournament = [];

for (let i = 0; i< liveDesignList.length; i++) {
    liveDesignTournament.push({
        genID: liveDesignList[i].genID,
        rank: 0,
        count: 0,
        indices: {}
    })
}

for (let i = 0; i< liveDesignList.length - 1; i++) {
    while (liveDesignTournament[i].count < tournament_size) {
        const randomIndex = Math.floor(Math.random() * liveDesignList.length);
        console.log('\t',randomIndex,'\t', liveDesignTournament[randomIndex].count)
        if (randomIndex === i || liveDesignTournament[i].indices[randomIndex] || liveDesignTournament[randomIndex].count >= tournament_size) { continue; }
        liveDesignTournament[i].count += 1;
        liveDesignTournament[i].indices[randomIndex] = true;
        liveDesignTournament[randomIndex].count += 1;
        liveDesignTournament[randomIndex].indices[i] = true;
        console.log(i, liveDesignTournament[i].count, randomIndex, liveDesignTournament[randomIndex].count)
    }
}

console.log(liveDesignTournament)
