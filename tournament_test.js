const population = 20;
const liveDesignList = [];
const deadDesignList = [];

for (let i = 0; i < population * 2; i++) {
    liveDesignList.push({
        genID: i,
        score: Math.random() * 10,
    });
}

const liveDesignTournament = [];
const failThreshold = 20;

const tournament_size = 9;

for (let i = 0; i < liveDesignList.length; i++) {
    liveDesignTournament.push({
        genID: liveDesignList[i].genID,
        score: liveDesignList[i].score,
        rank: 0,
        count: 0,
        indices: {},
    });
}

for (let i = 0; i < liveDesignList.length; i++) {
    let failCount = 0;
    while (liveDesignTournament[i].count < tournament_size) {
        const randomIndex = Math.floor(Math.random() * liveDesignList.length);
        if (randomIndex === i || liveDesignTournament[i].indices[randomIndex]) {
            continue;
        }
        if (failCount < failThreshold && liveDesignTournament[randomIndex].count >= tournament_size) {
            failCount += 1;
            continue;
        }
        if (failCount >= failThreshold) {
            console.log("  failed", failCount);
        }
        failCount = 0;
        if (liveDesignTournament[i].score > liveDesignTournament[randomIndex].score) {
            liveDesignTournament[i].rank += 1;
        }
        liveDesignTournament[i].count += 1;
        liveDesignTournament[i].indices[randomIndex] = true;
        if (liveDesignTournament[randomIndex].count < tournament_size) {
            liveDesignTournament[randomIndex].count += 1;
            liveDesignTournament[randomIndex].indices[i] = true;
            if (liveDesignTournament[randomIndex].score > liveDesignTournament[i].score) {
                liveDesignTournament[randomIndex].rank += 1;
            }
        }
    }
}

const sortedTournament = liveDesignTournament.sort((a, b) => {
    if (a.rank === b.rank) {
        return a.score - b.score;
    }
    return a.rank - b.rank;
});

for (let i = 0; i < population; i++) {

    for (let j = 0; j < liveDesignList.length; j++) {
        if (sortedTournament[i].genID === liveDesignList[j].genID) {
            deadDesignList.push(liveDesignList[j]);
            liveDesignList.splice(j,1);
            break;
        }
    }
}
sortedTournament.forEach((x) => console.log("   ", x.rank, '\t',x.score));

console.log('\n\n\nLIVE DESIGNS:')
liveDesignList.forEach((x) => console.log("   ", x.score));
console.log('\n\n\nDEAD DESIGNS:')
deadDesignList.forEach((x) => console.log("   ", x.score));
