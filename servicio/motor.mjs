// Preprocesamiento común para documentos y consultas en inglés.
const stopwords = new Set(`a about above after again against all am an and any are as at be
because been before being below between both but by can could d did do does doing down
during each few for from further had has have having he her here hers herself him himself
his how i if in into is it its itself just ll m me might more most must my myself no nor not
now of off on once only or other ought our ours ourselves out over own re s same she should
so some such t than that the their theirs them themselves then there these they this those
through to too under until up ve very was we were what when where which while who whom why
will with would you your yours yourself yourselves`.split(/\s+/u));

const paso2 = {
  ational: 'ate', tional: 'tion', enci: 'ence', anci: 'ance', izer: 'ize',
  bli: 'ble', alli: 'al', entli: 'ent', eli: 'e', ousli: 'ous', ization: 'ize',
  ation: 'ate', ator: 'ate', alism: 'al', iveness: 'ive', fulness: 'ful',
  ousness: 'ous', aliti: 'al', iviti: 'ive', biliti: 'ble', logi: 'log',
};
const paso3 = {
  icate: 'ic', ative: '', alize: 'al', iciti: 'ic', ical: 'ic', ful: '', ness: '',
};
const paso4 = Object.fromEntries(
  'al ance ence er ic able ible ant ement ment ent ion ou ism ate iti ous ive ize'
    .split(' ').map(sufijo => [sufijo, '']),
);

function estructura(palabra) {
  let patron = '';
  for (const letra of palabra) {
    const vocal = 'aeiou'.includes(letra) || (letra === 'y' && patron.endsWith('C'));
    patron += vocal ? 'V' : 'C';
  }
  return patron;
}

function medida(palabra) {
  return (estructura(palabra).match(/VC/g) ?? []).length;
}

function terminaCVC(palabra) {
  return estructura(palabra).endsWith('CVC') && !/[wxy]$/u.test(palabra);
}

function ordenarSufijos(reglas) {
  return Object.entries(reglas).sort(([a], [b]) => b.length - a.length);
}

const reglas2 = ordenarSufijos(paso2);
const reglas3 = ordenarSufijos(paso3);
const reglas4 = ordenarSufijos(paso4);

function aplicarSufijo(palabra, reglas, medidaMinima) {
  for (const [sufijo, reemplazo] of reglas) {
    if (!palabra.endsWith(sufijo)) continue;
    const raiz = palabra.slice(0, -sufijo.length);
    if (sufijo === 'ion' && !/[st]$/u.test(raiz)) return palabra;
    return medida(raiz) >= medidaMinima ? raiz + reemplazo : palabra;
  }
  return palabra;
}

function porter(palabra) {
  if (palabra.length <= 2 || !/^[a-z]+$/u.test(palabra)) return palabra;
  palabra = palabra.replace(/sses$/u, 'ss').replace(/ies$/u, 'i');
  if (!palabra.endsWith('ss')) palabra = palabra.replace(/s$/u, '');

  if (palabra.endsWith('eed')) {
    if (medida(palabra.slice(0, -3)) > 0) palabra = palabra.slice(0, -1);
  } else {
    const raiz = palabra.replace(/(?:ed|ing)$/u, '');
    if (raiz !== palabra && estructura(raiz).includes('V')) {
      palabra = raiz;
      if (/(at|bl|iz)$/u.test(palabra)) {
        palabra += 'e';
      } else if (/(.)\1$/u.test(palabra) && estructura(palabra).endsWith('C')) {
        if (!/[lsz]$/u.test(palabra)) palabra = palabra.slice(0, -1);
      } else if (medida(palabra) === 1 && terminaCVC(palabra)) {
        palabra += 'e';
      }
    }
  }

  if (palabra.endsWith('y') && estructura(palabra.slice(0, -1)).includes('V')) {
    palabra = palabra.slice(0, -1) + 'i';
  }
  palabra = aplicarSufijo(palabra, reglas2, 1);
  palabra = aplicarSufijo(palabra, reglas3, 1);
  palabra = aplicarSufijo(palabra, reglas4, 2);

  if (palabra.endsWith('e')) {
    const raiz = palabra.slice(0, -1);
    const m = medida(raiz);
    if (m > 1 || (m === 1 && !terminaCVC(raiz))) palabra = raiz;
  }
  if (palabra.endsWith('ll') && medida(palabra) > 1) palabra = palabra.slice(0, -1);
  return palabra;
}

export function tokenizar(texto, cache) {
  const normalizado = texto.normalize('NFKC').toLowerCase().replace(/n['’]t\b/gu, '');
  const tokens = normalizado.match(/[\p{L}\p{N}]+/gu) ?? [];
  return tokens.filter(token => !stopwords.has(token)).map(token => {
    if (!cache) return porter(token);
    if (!cache.has(token)) cache.set(token, porter(token));
    return cache.get(token);
  });
}

// Vocabulario, frecuencias y estadísticas de los documentos originales.
function contar(terminos) {
  const frecuencias = new Map();
  for (const termino of terminos) {
    frecuencias.set(termino, (frecuencias.get(termino) ?? 0) + 1);
  }
  return frecuencias;
}

function fragmento(texto) {
  const limpio = texto.trim().replace(/\s+/gu, ' ');
  return limpio.length <= 200 ? limpio : `${limpio.slice(0, 200)}…`;
}

export function construirIndice(corpus, k1 = 1.5, b = 0.75) {
  if (!corpus.length) throw new Error('El corpus está vacío.');
  const invertido = new Map();
  const cache = new Map();
  const longitudes = [];
  const documentos = corpus.map((doc, posicion) => {
    const frecuencias = contar(tokenizar(`${doc.title ?? ''} ${doc.text}`, cache));
    let longitud = 0;
    for (const [termino, tf] of frecuencias) {
      if (!invertido.has(termino)) invertido.set(termino, []);
      invertido.get(termino).push(posicion, tf);
      longitud += tf;
    }
    longitudes.push(longitud);
    return { id: doc._id, title: doc.title?.trim() ?? '', snippet: fragmento(doc.text) };
  });

  const n = documentos.length;
  const longitudMedia = longitudes.reduce((total, longitud) => total + longitud, 0) / n;
  const normasCuadradas = Array(n).fill(0);
  const vocabulario = Object.create(null);
  for (const [termino, postings] of invertido) {
    const df = postings.length / 2;
    const idfTfidf = Math.log1p(n / df);
    const idfBm25 = Math.log1p((n - df + 0.5) / (df + 0.5));
    vocabulario[termino] = [idfTfidf, idfBm25, postings];
    for (let i = 0; i < postings.length; i += 2) {
      const peso = (1 + Math.log(postings[i + 1])) * idfTfidf;
      normasCuadradas[postings[i]] += peso ** 2;
    }
  }

  const normasTfidf = normasCuadradas.map(Math.sqrt);
  const normasBm25 = longitudes.map(longitud =>
    k1 * (1 - b + b * (longitudMedia ? longitud / longitudMedia : 0)),
  );
  return { documentos, vocabulario, longitudMedia, normasTfidf, normasBm25, k1 };
}

// Ranking de los documentos con términos en común y desempate por ID original.
export function buscar(indice, consulta, modelo, topK) {
  const frecuencias = contar(tokenizar(consulta));
  const scores = new Map();
  let normaConsultaCuadrada = 0;

  for (const [termino, tfConsulta] of frecuencias) {
    if (!Object.hasOwn(indice.vocabulario, termino)) continue;
    const [idfTfidf, idfBm25, postings] = indice.vocabulario[termino];
    const pesoConsulta = (1 + Math.log(tfConsulta)) * idfTfidf;
    if (modelo === 'tfidf') normaConsultaCuadrada += pesoConsulta ** 2;

    for (let i = 0; i < postings.length; i += 2) {
      const posicion = postings[i];
      const tf = postings[i + 1];
      const aporte = modelo === 'tfidf'
        ? pesoConsulta * (1 + Math.log(tf)) * idfTfidf
        : idfBm25 * tf * (indice.k1 + 1) / (tf + indice.normasBm25[posicion]);
      scores.set(posicion, (scores.get(posicion) ?? 0) + aporte);
    }
  }

  if (modelo === 'tfidf') {
    const normaConsulta = Math.sqrt(normaConsultaCuadrada);
    for (const [posicion, score] of scores) {
      const coseno = score / (normaConsulta * indice.normasTfidf[posicion]);
      scores.set(posicion, Math.min(1, coseno));
    }
  }

  const documentos = indice.documentos;
  return [...scores].sort(([a, scoreA], [b, scoreB]) => {
    if (scoreA !== scoreB) return scoreB - scoreA;
    return documentos[a].id < documentos[b].id ? -1 : 1;
  }).slice(0, topK).map(([posicion, score], i) => ({
    rank: i + 1,
    document_id: documentos[posicion].id,
    score,
    title: documentos[posicion].title,
    snippet: documentos[posicion].snippet,
  }));
}
