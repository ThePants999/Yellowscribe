function union(...arrays) {
    return Array.from(new Set(arrays.flat()));
}

function allEqual(array) {
    // return array.every(v => v === array[0]);
    return Array.from(new Set(array)).length === 1;
}

module.exports.union = union;
module.exports.allEqual = allEqual;