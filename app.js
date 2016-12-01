/**
 * Created by nik on 27.11.16.
 */
const mysql = require('mysql');
const $ = require('cheerio');
const _ = require('lodash');
const fs = require('fs');
const request = require('request');
const co = require('co');
const path = require('path');

const slovar = fs.readFileSync('slovar1').toString();
const slovar2 = fs.readFileSync('slovar1').toString();
const LIMIT = 10;
const table1 = 'vacancies';
const table2 = 'vacancies2';
const httpTimeout = 1000; //сколько ждать отклик страницы

let offset = 0;
let summ = 0;

const sqlConf = {
  host: 'localhost',
  port: '3306',
  user: 'root',
  password: '1488228',
  database: 'my_db'
};

const db = mysql.createConnection(sqlConf);

Promise.all([createTable(table1), createTable(table2)])
  .then(() => {
    go(offset);
  })
  .catch(console.error);


function go(offset) {
  getUrls(offset)
    .then(urls => {
      if (!urls.length) return console.log('DONE');
      return loadUrl(urls);
    })
    .then(bodies => {
      return htmlParse(bodies, slovar);
    })
    .then(data => {
      return insertTable(table1, data).then(() => (data));
    })
    .then((urls) => {
      return loadUrl(urls);
    })
    .then(bodies => {
      return htmlParse(bodies, slovar2);
    })
    .then(data => {
      return insertTable(table2, data);
    })
    .then(() => {
      console.log(offset);
      offset+=LIMIT;
      go(offset);
    })
    .catch(err => {
      console.error(err);
      offset+=LIMIT;
      go(offset);
    });
}

function createTable(name) {
  return new Promise((resolve, reject) => {
    const query = [
      'CREATE TABLE IF NOT EXISTS `'+name+'` (',
      '`id` int(10) unsigned NOT NULL AUTO_INCREMENT,',
      '`name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,',
      '`content` varchar(1024) COLLATE utf8_unicode_ci NOT NULL,',
      '`url` varchar(1024) COLLATE utf8_unicode_ci NOT NULL,',
      '`company_id` int(10) unsigned NOT NULL,',
      'PRIMARY KEY (`id`)',
      ')'
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

function insertTable(name, data) {
  return new Promise((resolve, reject) => {
    if (!data.length) return resolve(null);
    var query = [
      'INSERT INTO `'+name+'` (`name`, `content`, `url`, `company_id`) VALUES'
    ];

    data.forEach((i, index) => {
      query.push('("'+i.name+'","'+i.content+'","'+i.url+'", '+i.company_id+')' + (index != data.length-1 ? ',' : ''))
    });

    db.query(query.join(' '), (err, result) => {
      if (err) {
        console.log(data);
        reject(err);
      } else {
        resolve(result);
      }
    })
  });
}

function getUrls(offset) {
  return new Promise((resolve, reject) => {
    const query = [
      'SELECT',
      '*',
      'FROM',
      sqlConf.database+'.companies',
      'LIMIT ' + offset + ', ' + LIMIT
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

function loadUrl(data) {
  const promises = data.map(i => {
    return new Promise((resolve, reject) => {
      var path = i.url.indexOf('http') == 0 ? i.url : 'http://'+i.url;
      request(path, {
        timeout: httpTimeout,
        followAllRedirects: true
      }, (err, res, body) => {
        if (err) {
          return resolve('');
        }
        var obj = {
          body: body,
          path: i.url,
          name: i.name,
          company_id: i.id || i.company_id
        };

        resolve(obj);
      });
    });
  });

  return Promise.all(promises);
}

function htmlParse(data, dic) {
  dic = dic.split('\n').join('|');
  var result = [];
  const reg = new RegExp('('+dic+')', 'i');

  data.forEach(item => {
    if (!item) return false;
    const doc = $.load(item.body);
    doc('a').each((i, el) => {
      el = $(el);
      var content = el.text();
      var link = el.attr('href');
      var match = content.match(reg);

      if (match && link) {
        if (!~link.indexOf('http')) {
          link = path.join(item.path.split('/')[0], link);
        }
        result.push(
          {
            name: match.pop(),
            content: _.trim(content).slice(0, 1024).replace(/['"\n]/g, ''),
            company_id: item.company_id,
            url: link
          }
        );
      }
    });
  });

  return _.uniqBy(result, 'url');
}