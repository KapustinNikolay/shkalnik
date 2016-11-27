/**
 * Created by nik on 27.11.16.
 */
const mysql = require('mysql');
const $ = require('cheerio');
const fs = require('fs');
const request = require('request');
const co = require('co');

const slovar = fs.readFileSync('slovar1').toString();

const sqlConf = {
  host: 'localhost',
  port: '3306',
  user: 'root',
  password: '1488228',
  database: 'my_db'
};

const db = mysql.createConnection(sqlConf);

co(function* () {
  const data = yield getUrls();
  var a = yield loadUrl(data[120].url);

  htmlParse(a, slovar);

  console.log(data[120].url);
})
  .catch(console.error);

function getUrls() {
  return new Promise((resolve, reject) => {
    const query = [
      'SELECT',
      '*',
      'FROM',
      sqlConf.database+'.companies',
      'LIMIT 200'
    ];

    db.query(query.join(' '), (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    })
  });
}

function loadUrl(url) {
  return new Promise((resolve, reject) => {
    request('http://'+url, (err, res, body) => {
      if (err) return reject(err);
      resolve(body);
    });
  });
}

function htmlParse(html, dic) {
  dic = dic.split('\n').join('|');
  var result = [];
  const reg = new RegExp('^('+dic+')$', 'i');
  const doc = $.load(html);
  const links = doc('a').each((i, el) => {
    el = $(el);
    if (reg.test(el.text())) {
      console.log(i, el.text(), '--', el.attr('href'))
    }
  });

}