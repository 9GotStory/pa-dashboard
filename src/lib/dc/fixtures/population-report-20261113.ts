import type { PopulationReportData } from "../types";

// The population rows of every year (2564–2568, yymm 6412–6812) of
// public/data/population.json from the snapshot built on 13 Nov 2569
// (meta.json built_at 2026-11-13T08:27:41Z): 10 rows a year, 8 of สำนักทะเบียน
// 5406 and 2 of 5489, as GAS answered them. That file has the village and age
// rows of 2568 only (SCHEMA §7); reports/population.json, which has them for
// every year, did not exist before F67, so village and age are [] here.

export const POPULATION_REPORT_DATA: PopulationReportData = {
  years: [
    {
      yymm: "6412",
      population: [
        {"yymm":"6412","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060100","tt_name":"ตำบลบ้านหนุน","mm":"0","mm_name":"","male":2308,"female":2499,"total":4807,"house":2080},
        {"yymm":"6412","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060200","tt_name":"ตำบลบ้านกลาง","mm":"0","mm_name":"","male":1810,"female":1837,"total":3647,"house":1403},
        {"yymm":"6412","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060300","tt_name":"ตำบลห้วยหม้าย","mm":"0","mm_name":"","male":3729,"female":4094,"total":7823,"house":3001},
        {"yymm":"6412","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060400","tt_name":"ตำบลเตาปูน","mm":"0","mm_name":"","male":3972,"female":4163,"total":8135,"house":2837},
        {"yymm":"6412","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060500","tt_name":"ตำบลหัวเมือง","mm":"0","mm_name":"","male":3056,"female":3159,"total":6215,"house":2204},
        {"yymm":"6412","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060600","tt_name":"ตำบลสะเอียบ","mm":"0","mm_name":"","male":2807,"female":2694,"total":5501,"house":2449},
        {"yymm":"6412","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060700","tt_name":"ตำบลแดนชุมพล","mm":"0","mm_name":"","male":1234,"female":1304,"total":2538,"house":918},
        {"yymm":"6412","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060800","tt_name":"ตำบลทุ่งน้าว","mm":"0","mm_name":"","male":1662,"female":1712,"total":3374,"house":1343},
        {"yymm":"6412","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5489","rcode_name":"ท้องถิ่นเทศบาลตำบลสอง","tt":"54060100","tt_name":"ตำบลบ้านหนุน","mm":"0","mm_name":"","male":1407,"female":1663,"total":3070,"house":1298},
        {"yymm":"6412","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5489","rcode_name":"ท้องถิ่นเทศบาลตำบลสอง","tt":"54060200","tt_name":"ตำบลบ้านกลาง","mm":"0","mm_name":"","male":1593,"female":1942,"total":3535,"house":1827},
      ],
      village: [],
      age: [],
    },
    {
      yymm: "6512",
      population: [
        {"yymm":"6512","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060100","tt_name":"ตำบลบ้านหนุน","mm":"0","mm_name":"","male":2272,"female":2474,"total":4746,"house":2105},
        {"yymm":"6512","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060200","tt_name":"ตำบลบ้านกลาง","mm":"0","mm_name":"","male":1767,"female":1820,"total":3587,"house":1418},
        {"yymm":"6512","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060300","tt_name":"ตำบลห้วยหม้าย","mm":"0","mm_name":"","male":3690,"female":4059,"total":7749,"house":3026},
        {"yymm":"6512","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060400","tt_name":"ตำบลเตาปูน","mm":"0","mm_name":"","male":3973,"female":4153,"total":8126,"house":2868},
        {"yymm":"6512","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060500","tt_name":"ตำบลหัวเมือง","mm":"0","mm_name":"","male":3020,"female":3127,"total":6147,"house":2228},
        {"yymm":"6512","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060600","tt_name":"ตำบลสะเอียบ","mm":"0","mm_name":"","male":2781,"female":2685,"total":5466,"house":2474},
        {"yymm":"6512","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060700","tt_name":"ตำบลแดนชุมพล","mm":"0","mm_name":"","male":1228,"female":1273,"total":2501,"house":930},
        {"yymm":"6512","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060800","tt_name":"ตำบลทุ่งน้าว","mm":"0","mm_name":"","male":1652,"female":1700,"total":3352,"house":1355},
        {"yymm":"6512","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5489","rcode_name":"ท้องถิ่นเทศบาลตำบลสอง","tt":"54060100","tt_name":"ตำบลบ้านหนุน","mm":"0","mm_name":"","male":1377,"female":1642,"total":3019,"house":1314},
        {"yymm":"6512","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5489","rcode_name":"ท้องถิ่นเทศบาลตำบลสอง","tt":"54060200","tt_name":"ตำบลบ้านกลาง","mm":"0","mm_name":"","male":1568,"female":1914,"total":3482,"house":1834},
      ],
      village: [],
      age: [],
    },
    {
      yymm: "6612",
      population: [
        {"yymm":"6612","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060100","tt_name":"ตำบลบ้านหนุน","mm":"0","mm_name":"","male":2228,"female":2453,"total":4681,"house":2134},
        {"yymm":"6612","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060200","tt_name":"ตำบลบ้านกลาง","mm":"0","mm_name":"","male":1746,"female":1781,"total":3527,"house":1438},
        {"yymm":"6612","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060300","tt_name":"ตำบลห้วยหม้าย","mm":"0","mm_name":"","male":3635,"female":4013,"total":7648,"house":3053},
        {"yymm":"6612","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060400","tt_name":"ตำบลเตาปูน","mm":"0","mm_name":"","male":3969,"female":4135,"total":8104,"house":2900},
        {"yymm":"6612","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060500","tt_name":"ตำบลหัวเมือง","mm":"0","mm_name":"","male":2993,"female":3097,"total":6090,"house":2251},
        {"yymm":"6612","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060600","tt_name":"ตำบลสะเอียบ","mm":"0","mm_name":"","male":2768,"female":2673,"total":5441,"house":2511},
        {"yymm":"6612","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060700","tt_name":"ตำบลแดนชุมพล","mm":"0","mm_name":"","male":1204,"female":1267,"total":2471,"house":938},
        {"yymm":"6612","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060800","tt_name":"ตำบลทุ่งน้าว","mm":"0","mm_name":"","male":1633,"female":1680,"total":3313,"house":1377},
        {"yymm":"6612","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5489","rcode_name":"ท้องถิ่นเทศบาลตำบลสอง","tt":"54060100","tt_name":"ตำบลบ้านหนุน","mm":"0","mm_name":"","male":1349,"female":1594,"total":2943,"house":1317},
        {"yymm":"6612","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5489","rcode_name":"ท้องถิ่นเทศบาลตำบลสอง","tt":"54060200","tt_name":"ตำบลบ้านกลาง","mm":"0","mm_name":"","male":1542,"female":1876,"total":3418,"house":1844},
      ],
      village: [],
      age: [],
    },
    {
      yymm: "6712",
      population: [
        {"yymm":"6712","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060100","tt_name":"ตำบลบ้านหนุน","mm":"0","mm_name":"","male":2174,"female":2445,"total":4619,"house":2148},
        {"yymm":"6712","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060200","tt_name":"ตำบลบ้านกลาง","mm":"0","mm_name":"","male":1703,"female":1748,"total":3451,"house":1460},
        {"yymm":"6712","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060300","tt_name":"ตำบลห้วยหม้าย","mm":"0","mm_name":"","male":3591,"female":3941,"total":7532,"house":3077},
        {"yymm":"6712","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060400","tt_name":"ตำบลเตาปูน","mm":"0","mm_name":"","male":3933,"female":4119,"total":8052,"house":2929},
        {"yymm":"6712","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060500","tt_name":"ตำบลหัวเมือง","mm":"0","mm_name":"","male":3017,"female":3091,"total":6108,"house":2274},
        {"yymm":"6712","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060600","tt_name":"ตำบลสะเอียบ","mm":"0","mm_name":"","male":2734,"female":2663,"total":5397,"house":2534},
        {"yymm":"6712","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060700","tt_name":"ตำบลแดนชุมพล","mm":"0","mm_name":"","male":1187,"female":1244,"total":2431,"house":951},
        {"yymm":"6712","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060800","tt_name":"ตำบลทุ่งน้าว","mm":"0","mm_name":"","male":1589,"female":1640,"total":3229,"house":1389},
        {"yymm":"6712","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5489","rcode_name":"ท้องถิ่นเทศบาลตำบลสอง","tt":"54060100","tt_name":"ตำบลบ้านหนุน","mm":"0","mm_name":"","male":1317,"female":1559,"total":2876,"house":1328},
        {"yymm":"6712","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5489","rcode_name":"ท้องถิ่นเทศบาลตำบลสอง","tt":"54060200","tt_name":"ตำบลบ้านกลาง","mm":"0","mm_name":"","male":1523,"female":1835,"total":3358,"house":1853},
      ],
      village: [],
      age: [],
    },
    {
      yymm: "6812",
      population: [
        {"yymm":"6812","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060100","tt_name":"ตำบลบ้านหนุน","mm":"0","mm_name":"","male":2136,"female":2400,"total":4536,"house":2163},
        {"yymm":"6812","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060200","tt_name":"ตำบลบ้านกลาง","mm":"0","mm_name":"","male":1675,"female":1736,"total":3411,"house":1474},
        {"yymm":"6812","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060300","tt_name":"ตำบลห้วยหม้าย","mm":"0","mm_name":"","male":3564,"female":3903,"total":7467,"house":3096},
        {"yymm":"6812","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060400","tt_name":"ตำบลเตาปูน","mm":"0","mm_name":"","male":3903,"female":4089,"total":7992,"house":2954},
        {"yymm":"6812","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060500","tt_name":"ตำบลหัวเมือง","mm":"0","mm_name":"","male":2975,"female":3062,"total":6037,"house":2297},
        {"yymm":"6812","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060600","tt_name":"ตำบลสะเอียบ","mm":"0","mm_name":"","male":2692,"female":2643,"total":5335,"house":2555},
        {"yymm":"6812","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060700","tt_name":"ตำบลแดนชุมพล","mm":"0","mm_name":"","male":1181,"female":1230,"total":2411,"house":957},
        {"yymm":"6812","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5406","rcode_name":"อำเภอสอง","tt":"54060800","tt_name":"ตำบลทุ่งน้าว","mm":"0","mm_name":"","male":1566,"female":1634,"total":3200,"house":1408},
        {"yymm":"6812","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5489","rcode_name":"ท้องถิ่นเทศบาลตำบลสอง","tt":"54060100","tt_name":"ตำบลบ้านหนุน","mm":"0","mm_name":"","male":1306,"female":1557,"total":2863,"house":1336},
        {"yymm":"6812","cc":"54","cc_name":"จังหวัดแพร่","rcode":"5489","rcode_name":"ท้องถิ่นเทศบาลตำบลสอง","tt":"54060200","tt_name":"ตำบลบ้านกลาง","mm":"0","mm_name":"","male":1477,"female":1798,"total":3275,"house":1861},
      ],
      village: [],
      age: [],
    },
  ],
};
