const INITIAL_PRODUCTS = [
    {
        id: 4,
        nameRu: "Дифенгидрамин гидрохлорид (Димедрол)",
        nameUz: "Difengidramin gidroxlorid (Dimedrol)",
        nameEn: "Diphenhydramine hydrochloride (Dimedrol)",
        category: "chemical",
        image: "",
        prices: { retail: 625000, wholesale: 550000 },
        minQty: 1,
        descriptionRu: "Антигистаминное средство. Бочка: 25 кг. Минимум: 1 кг.",
        descriptionUz: "Antigistamin vosita. Bochka: 25 kg. Minimum: 1 kg.",
        descriptionEn: "Antihistamine. Drum: 25 kg. Minimum: 1 kg.",
        status: "active"
    },
    {
        id: 5,
        nameRu: "Диклофенак натрия",
        nameUz: "Diklofenak natriy",
        nameEn: "Diclofenac sodium",
        category: "chemical",
        image: "",
        prices: { retail: 450000, wholesale: 380000 },
        minQty: 1,
        descriptionRu: "НПВП. Бочка: 25 кг. Минимум: 1 кг.",
        descriptionUz: "NSAID. Bochka: 25 kg. Minimum: 1 kg.",
        descriptionEn: "NSAID. Drum: 25 kg. Minimum: 1 kg.",
        status: "active"
    },
    {
        id: 6,
        nameRu: "Цитиколин натрия (Citicoline sodium)",
        nameUz: "Tsitikolin natriy",
        nameEn: "Citicoline sodium",
        category: "chemical",
        image: "https://i.ibb.co/N2JXcMXZ/4.webp",
        prices: { retail: 4000000, wholesale: 4000000 },
        minQty: 1,
        descriptionRu: "Ноотроп. Бочка: 25 кг. Минимум: 1 кг.",
        descriptionUz: "Nootrop. Bochka: 25 kg. Minimum: 1 kg.",
        descriptionEn: "Nootropic. Drum: 25 kg. Minimum: 1 kg.",
        status: "active"
    },
    {
        id: 7,
        nameRu: "Симетикон эмульсия 30%",
        nameUz: "Simetikon emulsiya 30%",
        nameEn: "Simethicone emulsion 30%",
        category: "chemical",
        image: "",
        prices: { retail: 230000, wholesale: 230000 },
        minQty: 50,
        descriptionRu: "Антифлатулент. Бочка: 50 кг. Минимум: 50 кг.",
        descriptionUz: "Antiflatulent. Bochka: 50 kg. Minimum: 50 kg.",
        descriptionEn: "Antiflatulent. Drum: 50 kg. Minimum: 50 kg.",
        status: "active"
    },
    {
        id: 8,
        nameRu: "Повидон йод",
        nameUz: "Povidon yod",
        nameEn: "Povidone iodine",
        category: "chemical",
        image: "",
        prices: { retail: 450000, wholesale: 400000 },
        minQty: 5,
        descriptionRu: "Антисептик. Бочка: 25 кг. Минимум: 5 кг.",
        descriptionUz: "Antiseptik. Bochka: 25 kg. Minimum: 5 kg.",
        descriptionEn: "Antiseptic. Drum: 25 kg. Minimum: 5 kg.",
        status: "active"
    },
    {
        id: 9,
        nameRu: "Полиэтиленгликоль 6000 (ПЭГ 6000)",
        nameUz: "Polietilenglikol 6000 (PEG 6000)",
        nameEn: "Polyethylene glycol 6000 (PEG 6000)",
        category: "excipient",
        image: "https://i.ibb.co/N2JXcMXZ/4.webp",
        prices: { retail: 130000, wholesale: 100000 },
        minQty: 1,
        descriptionRu: "Фармацевтический эксципиент. Бочка: 25 кг. Минимум: 1 кг.",
        descriptionUz: "Farmatsevtik eksipiyent. Bochka: 25 kg. Minimum: 1 kg.",
        descriptionEn: "Pharmaceutical excipient. Drum: 25 kg. Minimum: 1 kg.",
        status: "active"
    },
    {
        id: 10,
        nameRu: "Магния стеарат",
        nameUz: "Magniy stearat",
        nameEn: "Magnesium stearate",
        category: "excipient",
        image: "https://i.ibb.co/N2JXcMXZ/4.webp",
        prices: { retail: 75000, wholesale: 75000 },
        minQty: 15,
        descriptionRu: "Смазывающий агент. Мешок: 15 кг. Минимум: 15 кг.",
        descriptionUz: "Yog'lovchi modda. Qop: 15 kg. Minimum: 15 kg.",
        descriptionEn: "Lubricant. Bag: 15 kg. Minimum: 15 kg.",
        status: "active"
    },
    {
        id: 11,
        nameRu: "Метилпарабен (Нипагин)",
        nameUz: "Metilparaben (Nipagin)",
        nameEn: "Methylparaben (Nipagin)",
        category: "excipient",
        image: "https://i.ibb.co/N2JXcMXZ/4.webp",
        prices: { retail: 350000, wholesale: 300000 },
        minQty: 1,
        descriptionRu: "Консервант. Бочка: 25 кг. Минимум: 1 кг.",
        descriptionUz: "Konservant. Bochka: 25 kg. Minimum: 1 kg.",
        descriptionEn: "Preservative. Drum: 25 kg. Minimum: 1 kg.",
        status: "active"
    },
    {
        id: 12,
        nameRu: "Пропилпарабен (Нипазол)",
        nameUz: "Propilparaben (Nipazol)",
        nameEn: "Propylparaben (Nipazol)",
        category: "excipient",
        image: "https://i.ibb.co/N2JXcMXZ/4.webp",
        prices: { retail: 350000, wholesale: 300000 },
        minQty: 1,
        descriptionRu: "Консервант. Бочка: 25 кг. Минимум: 1 кг.",
        descriptionUz: "Konservant. Bochka: 25 kg. Minimum: 1 kg.",
        descriptionEn: "Preservative. Drum: 25 kg. Minimum: 1 kg.",
        status: "active"
    },
    {
        id: 13,
        nameRu: "Пропилпарабен натрий",
        nameUz: "Propilparaben natriy",
        nameEn: "Sodium propylparaben",
        category: "excipient",
        image: "https://i.ibb.co/N2JXcMXZ/4.webp",
        prices: { retail: 350000, wholesale: 300000 },
        minQty: 1,
        descriptionRu: "Консервант. Бочка: 25 кг. Минимум: 1 кг.",
        descriptionUz: "Konservant. Bochka: 25 kg. Minimum: 1 kg.",
        descriptionEn: "Preservative. Drum: 25 kg. Minimum: 1 kg.",
        status: "active"
    },
    {
        id: 14,
        nameRu: "Гидроксипропилметилцеллюлоза (Гипромелоза) HPMC",
        nameUz: "Gidroksipropilmetiltsellyuloza (Gipromeloza) HPMC",
        nameEn: "Hydroxypropyl methylcellulose (HPMC)",
        category: "excipient",
        image: "https://i.ibb.co/RGZXt7W7/16e5b0b663948251fb41b21e27bc7299.webp",
        prices: { retail: 250000, wholesale: 190000 },
        minQty: 1,
        descriptionRu: "Гипромеллоза. Бочка: 25 кг. Минимум: 1 кг.",
        descriptionUz: "Gipromeloza. Bochka: 25 kg. Minimum: 1 kg.",
        descriptionEn: "HPMC. Drum: 25 kg. Minimum: 1 kg.",
        status: "active"
    },
    {
        id: 15,
        nameRu: "Коллоидный диоксид кремния (Аэросил 200)",
        nameUz: "Kolloidal kremniy dioksid (Aerosil 200)",
        nameEn: "Colloidal silicon dioxide (Aerosil 200)",
        category: "excipient",
        image: "",
        prices: { retail: 2200000, wholesale: 220000 },
        minQty: 10,
        descriptionRu: "Фармацевтический наполнитель. Мешок: 10 кг. Минимум: 10 кг.",
        descriptionUz: "Farmatsevtik to'ldirgich. Qop: 10 kg. Minimum: 10 kg.",
        descriptionEn: "Pharmaceutical excipient. Bag: 10 kg. Minimum: 10 kg.",
        status: "active"
    },
    {
        id: 16,
        nameRu: "Кроскармеллоза натрия",
        nameUz: "Kroskarmeloza natriy",
        nameEn: "Croscarmellose sodium",
        category: "excipient",
        image: "https://i.ibb.co/9mDLD7Cb/1ef3e382a9d3d4e76ddb914f6195f577.webp",
        prices: { retail: 300000, wholesale: 275000 },
        minQty: 1,
        descriptionRu: "Супердизинтегрант. Бочка: 25 кг. Минимум: 1 кг.",
        descriptionUz: "Superdisintegrant. Bochka: 25 kg. Minimum: 1 kg.",
        descriptionEn: "Superdisintegrant. Drum: 25 kg. Minimum: 1 kg.",
        status: "active"
    },
    {
        id: 17,
        nameRu: "Микрокристаллическая целлюлоза 101 (МКЦ 101)",
        nameUz: "Mikrokristallik tsellyuloza 101 (MKTS 101)",
        nameEn: "Microcrystalline cellulose 101 (MCC 101)",
        category: "excipient",
        image: "https://i.ibb.co/N2JXcMXZ/4.webp",
        prices: { retail: 75000, wholesale: 75000 },
        minQty: 20,
        descriptionRu: "МКЦ 101. Мешок: 20 кг. Минимум: 20 кг.",
        descriptionUz: "MKTS 101. Qop: 20 kg. Minimum: 20 kg.",
        descriptionEn: "MCC 101. Bag: 20 kg. Minimum: 20 kg.",
        status: "active"
    },
    {
        id: 18,
        nameRu: "Натрий карбоксиметилцеллюлоза (Натрий КМЦ)",
        nameUz: "Natriy karboksimetiltsellyuloza (Natriy KMTS)",
        nameEn: "Sodium carboxymethylcellulose (CMC)",
        category: "excipient",
        image: "",
        prices: { retail: 100000, wholesale: 100000 },
        minQty: 25,
        descriptionRu: "Натрий КМЦ. Мешок: 25 кг. Минимум: 25 кг.",
        descriptionUz: "Natriy KMTS. Qop: 25 kg. Minimum: 25 kg.",
        descriptionEn: "Sodium CMC. Bag: 25 kg. Minimum: 25 kg.",
        status: "active"
    },
    {
        id: 19,
        nameRu: "Натрия крахмал гликолят",
        nameUz: "Natriy kraxmal glikolat",
        nameEn: "Sodium starch glycolate",
        category: "excipient",
        image: "https://i.ibb.co/N2JXcMXZ/4.webp",
        prices: { retail: 75000, wholesale: 75000 },
        minQty: 25,
        descriptionRu: "Супердизинтегрант. Мешок: 25 кг. Минимум: 25 кг.",
        descriptionUz: "Superdisintegrant. Qop: 25 kg. Minimum: 25 kg.",
        descriptionEn: "Superdisintegrant. Bag: 25 kg. Minimum: 25 kg.",
        status: "active"
    },
    {
        id: 20,
        nameRu: "Хинолин жёлтый (Quinoline yellow)",
        nameUz: "Xinolin sariq (Quinoline yellow)",
        nameEn: "Quinoline yellow",
        category: "chemical",
        image: "",
        prices: { retail: 600000, wholesale: 600000 },
        minQty: 1,
        descriptionRu: "Пищевой краситель. Банка: 5 кг. Минимум: 1 кг.",
        descriptionUz: "Ozuqali bo'yoq. Banka: 5 kg. Minimum: 1 kg.",
        descriptionEn: "Food colorant. Jar: 5 kg. Minimum: 1 kg.",
        status: "active"
    },
    {
        id: 21,
        nameRu: "Солнечный закат (Sunset yellow)",
        nameUz: "Quyosh botishi sariq (Sunset yellow)",
        nameEn: "Sunset yellow",
        category: "chemical",
        image: "",
        prices: { retail: 600000, wholesale: 600000 },
        minQty: 1,
        descriptionRu: "Пищевой краситель. Банка: 5 кг. Минимум: 1 кг.",
        descriptionUz: "Ozuqali bo'yoq. Banka: 5 kg. Minimum: 1 kg.",
        descriptionEn: "Food colorant. Jar: 5 kg. Minimum: 1 kg.",
        status: "active"
    },
    {
        id: 22,
        nameRu: "Нитрофуразол (Фурацилин)",
        nameUz: "Nitrofurozol (Furatsilin)",
        nameEn: "Nitrofurazone (Furacilin)",
        category: "chemical",
        image: "https://i.ibb.co/xKRbQpNG/b121558f3199ed5ca38627299198147a.webp",
        prices: { retail: 1150000, wholesale: 1050000 },
        minQty: 1,
        descriptionRu: "Антисептик. Бочка: 25 кг. Минимум: 1 кг.",
        descriptionUz: "Antiseptik. Bochka: 25 kg. Minimum: 1 kg.",
        descriptionEn: "Antiseptic. Drum: 25 kg. Minimum: 1 kg.",
        status: "active"
    },
    {
        id: 23,
        nameRu: "Фенирамина малеат",
        nameUz: "Feniramina maleat",
        nameEn: "Pheniramine maleate",
        category: "chemical",
        image: "https://i.ibb.co/N2JXcMXZ/4.webp",
        prices: { retail: 2600000, wholesale: 2400000 },
        minQty: 1,
        descriptionRu: "Антигистамин. Бочка: 25 кг. Минимум: 1 кг.",
        descriptionUz: "Antigistamin. Bochka: 25 kg. Minimum: 1 kg.",
        descriptionEn: "Antihistamine. Drum: 25 kg. Minimum: 1 kg.",
        status: "active"
    }
];


function parseBarrelQty(description) {
    if (!description) return null;
    const match = description.match(/(?:Бочка|Мешок|Банка|Bochka|Drum|Bag|Jar):\s*(\d+)\s*(?:кг|kg)/i);
    return match ? parseInt(match[1]) : null;
}

INITIAL_PRODUCTS.forEach(product => {
    if (!product.barrelQty) {
        product.barrelQty = parseBarrelQty(product.descriptionUz || product.descriptionRu || product.descriptionEn || '') || null;
    }
});
// Node.js uchun export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { INITIAL_PRODUCTS };
}
