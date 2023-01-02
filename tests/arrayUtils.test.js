const arrayUtils = require("../bin/arrayUtils");

test("union of 2 arrays", () => {
    expect(arrayUtils.union([ 1, 2 ], [ 3, 4 ]))
        .toStrictEqual([1, 2, 3, 4])
})

test("union of 3 arrays", () => {
    expect(arrayUtils.union([ 1, 2 ], [ 3, 4 ], [ 5, 6 ]))
        .toStrictEqual([1, 2, 3, 4, 5, 6])
})

test("union with duplicates", () => {
    expect(arrayUtils.union([ 1, 2 ], [ 2 ]))
        .toStrictEqual([1, 2])
})