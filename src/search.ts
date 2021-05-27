import * as _ from 'lodash'
import {Db, MongoClient, MongoClientOptions} from 'mongodb'

function create_sign_regexp(sign: string) {
    return sign === "*" ? "[^\\s]+" : "([X ])*([^\\s]+\\/)*" + _.escapeRegExp(sign) + "(\\/[^\\s]+)*([X ])*"
}

function create_line_regexp(line: string[]) {
    return line.map(create_sign_regexp).join(" ")
}

function create_regexp(signs: string[][]) {
    return signs.map(create_line_regexp).join("( .*)?\\n.*") + "(?![^| ])"
}

async function search(id: unknown, maxSigns: number, db: Db) {
    const fragment = await db.collection("fragments").findOne({_id: id})
    const signs = fragment.signs.replace(/X/g, "").replace(/ +/g, " ")
    const sign_matrix = signs.split("\n").map((line: string) => line.trim().split(" ").filter((sign: string) => sign !== "")).filter((line: string[]) => line.length > 0)
    if (sign_matrix.reduce((acc: any, line: string[]) => acc.concat(line), []).length > maxSigns) {
        return {
            _id: fragment._id,
            notes: fragment.notes
        }
    }
    let result = {}
    await Promise.all(sign_matrix.map((line: string[], y: number) => 
      Promise.all(line.map(async (sign, x) => {
        const wildcarded = JSON.parse(JSON.stringify(sign_matrix))
        wildcarded[y][x] = "*"
        result = (await db.collection("chapters").find(
          {_id: {$ne: id}, signs: new RegExp(create_regexp(wildcarded))}, 
          { projection: {_id: 1, textId: 1, stage: 1, name: 1}}
        ).toArray()).reduce((acc, match) => {            
            const stringId = String(match._id)
            if(!acc[stringId]) {
                acc[stringId] = {
                    numberOfMatches: 1,
                    _id: match._id,
                    textId: match.textId,
                    textName: "foo",  //(await db.collection("texts").findOne(match.textId)).name,
                    chapterName: match.name,
                }
            } else {
                acc[stringId].numberOfMatches++
            }
            return acc
        }, result)
      }))  
    ))
    return {
        _id: fragment._id,
        matches: Object.values(result),
        notes: fragment.notes
    }
}

export async function searchAll(uri: string, tls: boolean, skip: number, limit: number) {
    const dbName = 'ebl'
    const options: MongoClientOptions = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    }
    if (tls) {
        options.tls = true
        options.tlsAllowInvalidCertificates = true
    }
    const client = new MongoClient(uri, options)
    try {
        await client.connect()
        const database: Db = client.db(dbName);
        await Promise.all((await database.collection("fragments")
            .find({signs: {$ne: "", $exists: true}})
            .sort( { _id: 1 } )
            .skip(skip).limit(limit).toArray())
            .map(({_id}: {_id: unknown}) => search(_id, 100, database).then(console.log)))
    } finally {
        await client.close()
    }
}

