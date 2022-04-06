const Sql = require('@cloki/clickhouse-sql')
const { labelAndVal } = require('./common')
const { DATABASE_NAME } = require('../../../lib/utils')
class AliasedSelect {
  /**
   *
   * @param sel {Select}
   * @param alias {String}
   */
  constructor (sel, alias) {
    this.sel = sel
    this.alias = alias
  }

  toString () {
    return `(${this.sel}) as ${this.alias}`
  }
}

class Match extends Sql.Raw {
  constructor (col, re) {
    super('')
    this.col = col
    this.re = re
  }

  toString () {
    return `match(${this.col}, ${this.re})`
  }
}

/**
 *
 * @param query {Select}
 * @param subquery {Select}
 * @returns {Select}
 */
module.exports.indexedAnd = (query, subquery) => {
  const idxSel = query.with() && query.with().idx_sel ? query.with().idx_sel : null
  const id = Math.random().toString().substr(2)
  if (idxSel) {
    idxSel.query.join(new AliasedSelect(subquery, Sql.quoteTerm(id)), ' inner any ',
      Sql.Eq(idxSel.query.tables[0][1].term + '.fingerprint', Sql.quoteTerm(`${id}.fingerprint`)))
    return query
  }
  return query.with(new Sql.With('idx_sel', (new Sql.Select())
    .select(`${id}.fingerprint`)
    .from([subquery, id])))
    .where(Sql.raw('samples.fingerprint IN idx_sel'))
}

/**
 *
 * @param token {Token}
 * @param fn {function(String, any): Object} Sql.Eq, Sql.Neq etc
 * @param formatVal? {function(string): Object} Sql.quoteVal or smth
 * @returns {Select}
 */
const processIndexed = (token, fn, formatVal) => {
  const [label, val] = labelAndVal(token)
  formatVal = formatVal || Sql.quoteVal
  return (new Sql.Select()).select('fingerprint')
    .from(`${DATABASE_NAME()}.time_series_gin`)
    .where(Sql.And(Sql.Eq('key', Sql.quoteVal(label)), fn('val', formatVal(val))))
}

/**
 *
 * @param token {Token}
 * @returns {Select}
 */
module.exports.eqIndexed = (token) => {
  return processIndexed(token, Sql.Eq)
}

module.exports.neqIndexed = (token) => {
  return processIndexed(token, Sql.Ne)
}

module.exports.reIndexed = (token) => {
  return processIndexed(token, (col, val) => Sql.Eq(new Match(col, val), 1))
}

module.exports.nreIndexed = (token) => {
  return processIndexed(token, (col, val) => Sql.Eq(new Match(col, val), 0))
}
