// Gedächtnis: Kurze Geschichten hören oder lesen, danach Fragen mit großen Antwortknöpfen
// (Wer? Wann? Was? Wo?) – angelehnt an Textgedächtnis-Aufgaben aus der Reha.
import { h, sleep, debounced, feedback, shuffle } from "../core/ui.js";
import { wartenAuf, frageAuswahl } from "./einkaufsliste.js";
import { modusWahl, sprichUndWarte, LAUTSPRECHER } from "./woerter.js";

// ---------- 20 eigenständige Alltagsgeschichten, je mit Fragen ----------
// Jede Frage hat genau vier Antworten (eine davon `loesung`), Ablenker passen thematisch,
// damit sie nicht durch bloßes Raten auffallen.
export const GESCHICHTEN = [
  {
    titel: "Der Wocheneinkauf",
    text: "Frau Berger ging am Donnerstagmorgen zum Wochenmarkt. Sie kaufte einen Korb voller Äpfel und ein Bund Petersilie. An einem Stand kaufte sie außerdem frischen Fisch für das Abendessen. Auf dem Heimweg traf sie ihre Nachbarin Frau Klein und die beiden tranken zusammen einen Kaffee im Café am Marktplatz.",
    fragen: [
      { frage: "Wer ging zum Markt?", loesung: "Frau Berger", ablenker: ["Frau Klein", "Herr Berger", "Die Nachbarin"] },
      { frage: "Wann ging sie zum Markt?", loesung: "Donnerstagmorgen", ablenker: ["Freitagabend", "Sonntagmittag", "Montagfrüh"] },
      { frage: "Was kaufte sie zum Abendessen?", loesung: "Fisch", ablenker: ["Hähnchen", "Wurst", "Käse"] },
      { frage: "Wen traf sie auf dem Heimweg?", loesung: "Frau Klein", ablenker: ["Ihren Sohn", "Den Bäcker", "Herrn Berger"] },
    ],
  },
  {
    titel: "Das Geburtstagsfest",
    text: "Am Samstag feierte Opa Heinrich seinen achtzigsten Geburtstag im Garten. Seine Enkelin Mia hatte einen Schokoladenkuchen gebacken und mit gelben Blumen verziert. Zwanzig Gäste kamen, darunter der alte Freund Karl aus der Nachbarschaft. Als es zu regnen begann, zogen alle schnell ins Wohnzimmer um.",
    fragen: [
      { frage: "Wer hatte Geburtstag?", loesung: "Opa Heinrich", ablenker: ["Mia", "Karl", "Die Nachbarin"] },
      { frage: "Wie alt wurde er?", loesung: "Achtzig", ablenker: ["Siebzig", "Neunzig", "Fünfundsiebzig"] },
      { frage: "Was hatte Mia gebacken?", loesung: "Einen Schokoladenkuchen", ablenker: ["Einen Apfelkuchen", "Kekse", "Ein Brot"] },
      { frage: "Warum zogen alle ins Wohnzimmer um?", loesung: "Es begann zu regnen", ablenker: ["Es wurde kalt", "Die Musik war zu laut", "Es wurde dunkel"] },
    ],
  },
  {
    titel: "Der verlorene Schlüssel",
    text: "Herr Wagner suchte am Dienstagabend verzweifelt seinen Hausschlüssel. Er hatte ihn zuletzt in der Jackentasche im Flur gesehen. Nach einer halben Stunde fand seine Frau Ute den Schlüssel unter dem Sofakissen im Wohnzimmer. Herr Wagner war so erleichtert, dass er sofort einen Ersatzschlüssel anfertigen ließ.",
    fragen: [
      { frage: "Wer suchte den Schlüssel?", loesung: "Herr Wagner", ablenker: ["Ute", "Der Nachbar", "Der Sohn"] },
      { frage: "Wo fand Ute den Schlüssel?", loesung: "Unter dem Sofakissen", ablenker: ["In der Jackentasche", "Auf dem Küchentisch", "Im Briefkasten"] },
      { frage: "Wann suchte er den Schlüssel?", loesung: "Dienstagabend", ablenker: ["Mittwochmorgen", "Sonntagnachmittag", "Freitagnacht"] },
      { frage: "Was tat Herr Wagner danach?", loesung: "Er ließ einen Ersatzschlüssel anfertigen", ablenker: ["Er wechselte das Schloss", "Er kaufte eine neue Tür", "Er rief die Polizei"] },
    ],
  },
  {
    titel: "Die Zugfahrt nach Hamburg",
    text: "Am Freitag fuhr Sabine mit dem Zug nach Hamburg, um ihre Schwester zu besuchen. Die Fahrt dauerte drei Stunden und sie las dabei ein Buch über alte Leuchttürme. In Hamburg angekommen, holte ihre Schwester Lena sie vom Bahnhof ab und beide gingen gemeinsam zum Hafen essen.",
    fragen: [
      { frage: "Wer fuhr nach Hamburg?", loesung: "Sabine", ablenker: ["Lena", "Die Mutter", "Eine Freundin"] },
      { frage: "Wie lange dauerte die Fahrt?", loesung: "Drei Stunden", ablenker: ["Eine Stunde", "Fünf Stunden", "Zwei Stunden"] },
      { frage: "Worüber las sie im Buch?", loesung: "Leuchttürme", ablenker: ["Schiffe", "Fische", "Inseln"] },
      { frage: "Wo aßen die Schwestern?", loesung: "Am Hafen", ablenker: ["Am Bahnhof", "Zu Hause", "Im Zug"] },
    ],
  },
  {
    titel: "Der Regenschirm",
    text: "Am Montagmorgen vergaß Herr Fischer seinen Regenschirm zu Hause, obwohl dunkle Wolken am Himmel standen. Unterwegs zur Arbeit begann es heftig zu regnen. Zum Glück lieh ihm seine Kollegin Anna an der Bushaltestelle ihren zweiten Schirm. Am Abend brachte er ihr den Schirm mit einer Tafel Schokolade als Dank zurück.",
    fragen: [
      { frage: "Was vergaß Herr Fischer?", loesung: "Den Regenschirm", ablenker: ["Die Handschuhe", "Die Mütze", "Die Tasche"] },
      { frage: "Wer half ihm mit einem Schirm?", loesung: "Anna", ablenker: ["Seine Frau", "Der Busfahrer", "Ein Fremder"] },
      { frage: "Wo lieh sie ihm den Schirm?", loesung: "An der Bushaltestelle", ablenker: ["Im Büro", "Im Supermarkt", "Zu Hause"] },
      { frage: "Womit bedankte er sich?", loesung: "Mit einer Tafel Schokolade", ablenker: ["Mit Blumen", "Mit einer Karte", "Mit Keksen"] },
    ],
  },
  {
    titel: "Der Ausflug in den Zoo",
    text: "Familie Berg besuchte am Sonntag den Zoo mit ihren beiden Kindern Paul und Lotte. Zuerst schauten sie sich die Elefanten an, danach die Affen im großen Freigehege. Paul wollte unbedingt die Pinguine sehen, doch die schliefen gerade alle. Zum Abschluss aßen alle ein Eis am Ausgang.",
    fragen: [
      { frage: "An welchem Tag war der Ausflug?", loesung: "Sonntag", ablenker: ["Samstag", "Mittwoch", "Freitag"] },
      { frage: "Was schauten sie zuerst an?", loesung: "Die Elefanten", ablenker: ["Die Affen", "Die Pinguine", "Die Löwen"] },
      { frage: "Was wollte Paul unbedingt sehen?", loesung: "Die Pinguine", ablenker: ["Die Giraffen", "Die Bären", "Die Vögel"] },
      { frage: "Was aßen sie zum Abschluss?", loesung: "Ein Eis", ablenker: ["Popcorn", "Kuchen", "Waffeln"] },
    ],
  },
  {
    titel: "Die neue Brille",
    text: "Herr Krüger bemerkte, dass er die Zeitung nicht mehr gut lesen konnte. Am Mittwoch ging er zum Optiker in der Bahnhofstraße und ließ seine Augen prüfen. Der Optiker Herr Sommer empfahl ihm eine Lesebrille mit dünnem Rahmen. Eine Woche später konnte Herr Krüger seine Zeitung wieder mühelos lesen.",
    fragen: [
      { frage: "Was konnte Herr Krüger nicht mehr gut?", loesung: "Die Zeitung lesen", ablenker: ["Fernsehen", "Kochen", "Gehen"] },
      { frage: "In welcher Straße war der Optiker?", loesung: "Bahnhofstraße", ablenker: ["Marktstraße", "Gartenweg", "Hauptstraße"] },
      { frage: "Wie hieß der Optiker?", loesung: "Herr Sommer", ablenker: ["Herr Krüger", "Herr Winter", "Herr Fischer"] },
      { frage: "Was empfahl der Optiker?", loesung: "Eine Lesebrille mit dünnem Rahmen", ablenker: ["Eine Sonnenbrille", "Kontaktlinsen", "Eine dicke Brille"] },
    ],
  },
  {
    titel: "Das verlegte Rezept",
    text: "Frau Neumann wollte am Donnerstag ihr Lieblingsgericht kochen, konnte das Rezept aber nicht finden. Sie suchte zwanzig Minuten lang in der Küche, bis sie es schließlich im Kochbuch ihrer Mutter entdeckte. Das Gericht, ein Linseneintopf, gelang ihr am Ende besonders gut und die ganze Familie lobte sie dafür.",
    fragen: [
      { frage: "Was suchte Frau Neumann?", loesung: "Ein Rezept", ablenker: ["Einen Löffel", "Eine Schürze", "Einen Topf"] },
      { frage: "Wo fand sie es schließlich?", loesung: "Im Kochbuch ihrer Mutter", ablenker: ["In der Schublade", "Im Kühlschrank", "Auf dem Tisch"] },
      { frage: "Welches Gericht kochte sie?", loesung: "Linseneintopf", ablenker: ["Kartoffelsuppe", "Gulasch", "Nudelauflauf"] },
      { frage: "Wie lange suchte sie?", loesung: "Zwanzig Minuten", ablenker: ["Eine Stunde", "Zehn Minuten", "Den ganzen Nachmittag"] },
    ],
  },
  {
    titel: "Der Spaziergang am See",
    text: "An einem sonnigen Nachmittag im Mai machte Herr Vogel einen Spaziergang um den See. Er beobachtete zwei Schwäne, die mit ihren Jungen im Wasser schwammen. Auf einer Bank traf er seinen alten Schulfreund Dieter, den er seit zehn Jahren nicht gesehen hatte. Sie unterhielten sich eine Stunde lang über alte Zeiten.",
    fragen: [
      { frage: "In welchem Monat war der Spaziergang?", loesung: "Mai", ablenker: ["Januar", "August", "Oktober"] },
      { frage: "Welche Tiere beobachtete er?", loesung: "Schwäne", ablenker: ["Enten", "Fische", "Gänse"] },
      { frage: "Wen traf er auf der Bank?", loesung: "Dieter", ablenker: ["Seinen Bruder", "Seinen Nachbarn", "Einen Fremden"] },
      { frage: "Seit wann hatten sie sich nicht gesehen?", loesung: "Zehn Jahren", ablenker: ["Zwei Jahren", "Einem Jahr", "Fünf Jahren"] },
    ],
  },
  {
    titel: "Die Reparatur des Fahrrads",
    text: "Am Samstagvormittag hatte Toms Fahrrad einen platten Reifen. Sein Vater half ihm in der Garage, den Reifen zu flicken und die Kette zu ölen. Nach einer Stunde Arbeit funktionierte das Fahrrad wieder einwandfrei. Zur Belohnung fuhren beide gemeinsam eine Runde durch den nahen Park.",
    fragen: [
      { frage: "Was war kaputt?", loesung: "Ein Reifen", ablenker: ["Die Bremse", "Die Kette", "Der Sattel"] },
      { frage: "Wer half beim Reparieren?", loesung: "Der Vater", ablenker: ["Die Mutter", "Ein Nachbar", "Der Bruder"] },
      { frage: "Wo wurde repariert?", loesung: "In der Garage", ablenker: ["Im Keller", "Im Garten", "Auf der Straße"] },
      { frage: "Was machten sie zur Belohnung?", loesung: "Eine Runde durch den Park fahren", ablenker: ["Eis essen", "Fernsehen", "Einkaufen gehen"] },
    ],
  },
  {
    titel: "Der Brief aus Amerika",
    text: "Eines Morgens im Juni fand Frau Lehmann einen Brief ihres Cousins aus Amerika im Briefkasten. Er schrieb, dass er im Herbst nach Deutschland zu Besuch kommen wolle. Frau Lehmann freute sich sehr und rief sofort ihre Schwester an, um die Neuigkeit zu erzählen. Gemeinsam planten sie schon, was sie ihm alles zeigen wollten.",
    fragen: [
      { frage: "Von wem kam der Brief?", loesung: "Vom Cousin aus Amerika", ablenker: ["Von der Schwester", "Von einer Freundin", "Vom Sohn"] },
      { frage: "In welchem Monat kam der Brief an?", loesung: "Juni", ablenker: ["Dezember", "März", "September"] },
      { frage: "Wann wollte der Cousin kommen?", loesung: "Im Herbst", ablenker: ["Im Winter", "Im Frühling", "Im Sommer"] },
      { frage: "Wen rief Frau Lehmann an?", loesung: "Ihre Schwester", ablenker: ["Ihren Mann", "Den Cousin", "Eine Nachbarin"] },
    ],
  },
  {
    titel: "Das Missgeschick beim Backen",
    text: "Am Sonntagnachmittag wollte Frau Otto einen Marmorkuchen für den Kaffeeklatsch backen. Sie vergaß jedoch den Zucker hinzuzufügen und bemerkte den Fehler erst beim Probieren. Schnell backte sie einen zweiten Kuchen, diesmal mit allen Zutaten. Die Gäste lobten den Kuchen später sehr und wollten das Rezept haben.",
    fragen: [
      { frage: "Was wollte Frau Otto backen?", loesung: "Einen Marmorkuchen", ablenker: ["Einen Apfelkuchen", "Ein Brot", "Kekse"] },
      { frage: "Was hatte sie vergessen?", loesung: "Den Zucker", ablenker: ["Das Mehl", "Die Eier", "Die Butter"] },
      { frage: "Wann bemerkte sie den Fehler?", loesung: "Beim Probieren", ablenker: ["Beim Backen", "Beim Einkaufen", "Am nächsten Tag"] },
      { frage: "Was wollten die Gäste haben?", loesung: "Das Rezept", ablenker: ["Ein Stück mehr", "Die Backform", "Den Kaffee"] },
    ],
  },
  {
    titel: "Der Waldspaziergang im Herbst",
    text: "An einem klaren Oktobertag ging Herr Baumann mit seinem Hund Bruno in den Wald. Die Blätter waren bunt gefärbt und raschelten unter seinen Schuhen. Bruno fand eine Handvoll Eicheln und trug sie stolz im Maul nach Hause. Am Waldrand sammelte Herr Baumann noch einen Korb voller Pilze für das Abendessen.",
    fragen: [
      { frage: "In welchem Monat spielt die Geschichte?", loesung: "Oktober", ablenker: ["April", "Juli", "Januar"] },
      { frage: "Wie hieß der Hund?", loesung: "Bruno", ablenker: ["Rex", "Bello", "Max"] },
      { frage: "Was fand Bruno?", loesung: "Eicheln", ablenker: ["Kastanien", "Nüsse", "Blätter"] },
      { frage: "Was sammelte Herr Baumann?", loesung: "Pilze", ablenker: ["Beeren", "Holz", "Blumen"] },
    ],
  },
  {
    titel: "Der Besuch beim Zahnarzt",
    text: "Am Dienstag hatte Frau Schulz einen Termin beim Zahnarzt Dr. Meier. Sie war etwas nervös, doch die Behandlung war schnell vorbei und tat kaum weh. Die Arzthelferin Frau Berg gab ihr danach noch Tipps zur Zahnpflege. Zur Belohnung gönnte sich Frau Schulz auf dem Heimweg ein Stück Kuchen im Café.",
    fragen: [
      { frage: "Bei wem war Frau Schulz?", loesung: "Beim Zahnarzt Dr. Meier", ablenker: ["Beim Hausarzt", "Beim Augenarzt", "Bei der Physiotherapeutin"] },
      { frage: "An welchem Tag war der Termin?", loesung: "Dienstag", ablenker: ["Donnerstag", "Samstag", "Montag"] },
      { frage: "Wer gab ihr Tipps zur Zahnpflege?", loesung: "Frau Berg, die Arzthelferin", ablenker: ["Dr. Meier selbst", "Eine Nachbarin", "Ihre Tochter"] },
      { frage: "Womit belohnte sie sich?", loesung: "Mit einem Stück Kuchen", ablenker: ["Mit einem Eis", "Mit Schokolade", "Mit einem Buch"] },
    ],
  },
  {
    titel: "Die verlorene Katze",
    text: "Eines Abends im März kam die Katze der Familie Roth nicht wie gewohnt nach Hause. Die Kinder Lena und Finn suchten mit Taschenlampen im ganzen Garten. Nach zwei Stunden fanden sie die Katze schließlich verängstigt auf dem Dach der Gartenhütte. Der Vater holte eine Leiter und rettete das Tier vorsichtig herunter.",
    fragen: [
      { frage: "In welchem Monat spielt die Geschichte?", loesung: "März", ablenker: ["Juni", "November", "August"] },
      { frage: "Wer suchte die Katze?", loesung: "Lena und Finn", ablenker: ["Die Eltern", "Die Nachbarn", "Der Vater allein"] },
      { frage: "Wo fanden sie die Katze?", loesung: "Auf dem Dach der Gartenhütte", ablenker: ["Unter dem Auto", "Im Keller", "Auf einem Baum"] },
      { frage: "Womit rettete der Vater die Katze?", loesung: "Mit einer Leiter", ablenker: ["Mit einem Stuhl", "Mit einem Seil", "Mit einem Netz"] },
    ],
  },
  {
    titel: "Das Konzert im Park",
    text: "Am ersten warmen Abend im Mai gab die Stadtkapelle ein Konzert im Stadtpark. Herr und Frau Adler nahmen Klappstühle und eine Decke mit, um sich gemütlich hinzusetzen. Es wurden vor allem alte Volkslieder gespielt, die viele Zuhörer mitsangen. Am Ende gab es großen Applaus und ein kleines Feuerwerk.",
    fragen: [
      { frage: "Wo fand das Konzert statt?", loesung: "Im Stadtpark", ablenker: ["In der Kirche", "In der Stadthalle", "Auf dem Marktplatz"] },
      { frage: "Was brachten Herr und Frau Adler mit?", loesung: "Klappstühle und eine Decke", ablenker: ["Einen Picknickkorb", "Regenschirme", "Ferngläser"] },
      { frage: "Was wurde vor allem gespielt?", loesung: "Alte Volkslieder", ablenker: ["Klassische Musik", "Rockmusik", "Weihnachtslieder"] },
      { frage: "Was gab es am Ende?", loesung: "Ein kleines Feuerwerk", ablenker: ["Ein Abendessen", "Eine Tanzvorführung", "Eine Ansprache"] },
    ],
  },
  {
    titel: "Der neue Nachbar",
    text: "Im Juli zog Herr Sandmann in die Wohnung neben Frau Winter ein. Er brachte ihr am ersten Tag einen Topf mit selbstgemachter Marmelade als Willkommensgeschenk vorbei. Frau Winter lud ihn daraufhin zum Kaffee ein und die beiden unterhielten sich lange über den Garten. Seitdem gießen sie abwechselnd die Blumen im Hof.",
    fragen: [
      { frage: "Wer zog neu ein?", loesung: "Herr Sandmann", ablenker: ["Frau Winter", "Ein Ehepaar", "Eine Studentin"] },
      { frage: "In welchem Monat zog er ein?", loesung: "Juli", ablenker: ["Februar", "Oktober", "Dezember"] },
      { frage: "Was brachte er mit?", loesung: "Selbstgemachte Marmelade", ablenker: ["Einen Kuchen", "Blumen", "Wein"] },
      { frage: "Was machen sie seitdem abwechselnd?", loesung: "Die Blumen im Hof gießen", ablenker: ["Den Müll rausbringen", "Das Treppenhaus putzen", "Einkaufen gehen"] },
    ],
  },
  {
    titel: "Die Wanderung auf den Berg",
    text: "An einem klaren Samstag im September wanderte Frau Hartmann mit ihrer Wandergruppe auf den Hausberg. Der Aufstieg dauerte etwa zwei Stunden und führte durch einen dichten Tannenwald. Oben angekommen, genossen alle die weite Aussicht und aßen mitgebrachte Brote. Auf dem Rückweg begann es leicht zu nieseln.",
    fragen: [
      { frage: "In welchem Monat war die Wanderung?", loesung: "September", ablenker: ["Mai", "Januar", "Juli"] },
      { frage: "Wie lange dauerte der Aufstieg?", loesung: "Etwa zwei Stunden", ablenker: ["Eine halbe Stunde", "Vier Stunden", "Eine Stunde"] },
      { frage: "Durch welchen Wald führte der Weg?", loesung: "Einen Tannenwald", ablenker: ["Einen Birkenwald", "Einen Eichenwald", "Einen Buchenwald"] },
      { frage: "Was passierte auf dem Rückweg?", loesung: "Es begann zu nieseln", ablenker: ["Es wurde sehr heiß", "Es wurde stürmisch", "Es schneite"] },
    ],
  },
  {
    titel: "Der Umzug ins neue Haus",
    text: "Im April zog Familie Peters nach zwanzig Jahren aus ihrer Wohnung in ein kleines Haus am Stadtrand. Die Söhne Jan und Max halfen fleißig beim Tragen der Kartons und Möbel. Am Abend feierten alle die erste Nacht im neuen Zuhause mit einer Pizza auf dem Boden im leeren Wohnzimmer. Die neue Adresse gefiel allen von Anfang an.",
    fragen: [
      { frage: "In welchem Monat zog die Familie um?", loesung: "April", ablenker: ["November", "Juni", "August"] },
      { frage: "Wie lange hatten sie vorher in der Wohnung gelebt?", loesung: "Zwanzig Jahre", ablenker: ["Zehn Jahre", "Fünf Jahre", "Zwei Jahre"] },
      { frage: "Wer half beim Tragen?", loesung: "Die Söhne Jan und Max", ablenker: ["Die Nachbarn", "Eine Umzugsfirma", "Die Großeltern"] },
      { frage: "Was aßen sie am ersten Abend?", loesung: "Pizza", ablenker: ["Nudeln", "Suppe", "Brot mit Käse"] },
    ],
  },
  {
    titel: "Das Missverständnis am Telefon",
    text: "Am Mittwochabend rief Herr Kramer seinen Bruder an, um sich für Samstag zum Kaffee zu verabreden. Wegen einer schlechten Verbindung verstand der Bruder jedoch Sonntag statt Samstag. So wartete Herr Kramer am Samstag vergeblich, bis sein Bruder erst am Sonntag vor der Tür stand. Am Ende lachten beide herzlich über das Missverständnis.",
    fragen: [
      { frage: "Wer rief an?", loesung: "Herr Kramer", ablenker: ["Der Bruder", "Die Frau von Herrn Kramer", "Ein Freund"] },
      { frage: "Wofür wollte er sich verabreden?", loesung: "Zum Kaffee", ablenker: ["Zum Mittagessen", "Zum Spazieren", "Zum Skat"] },
      { frage: "Welchen Tag verstand der Bruder falsch?", loesung: "Sonntag statt Samstag", ablenker: ["Freitag statt Samstag", "Montag statt Sonntag", "Samstag statt Freitag"] },
      { frage: "Wie reagierten beide am Ende?", loesung: "Sie lachten herzlich", ablenker: ["Sie ärgerten sich", "Sie stritten kurz", "Sie waren traurig"] },
    ],
  },
  {
    titel: "Der Sturm in der Nacht",
    text: "In der Nacht zum Freitag im November zog ein heftiger Sturm über die Stadt. Bei Familie Dietz fiel dabei ein alter Ast vom Nachbarbaum auf die Terrasse. Zum Glück wurde niemand verletzt, nur ein Blumentopf ging zu Bruch. Am nächsten Morgen half der Nachbar Herr Brandt, den Ast gemeinsam wegzuräumen.",
    fragen: [
      { frage: "In welchem Monat war der Sturm?", loesung: "November", ablenker: ["Juni", "März", "August"] },
      { frage: "Was fiel auf die Terrasse?", loesung: "Ein alter Ast", ablenker: ["Ein Dachziegel", "Ein Gartenstuhl", "Ein Zaunteil"] },
      { frage: "Was ging zu Bruch?", loesung: "Ein Blumentopf", ablenker: ["Ein Fenster", "Eine Gartenlampe", "Ein Gartentisch"] },
      { frage: "Wer half am nächsten Morgen?", loesung: "Herr Brandt, der Nachbar", ablenker: ["Der Sohn", "Ein Handwerker", "Die Feuerwehr"] },
    ],
  },
];

// ---------- Reine Logik (testbar) ----------

/** Schwierigkeit je Stufe 1–20 */
export function geschichteParameter(stufe) {
  const s = Math.max(1, Math.min(20, Math.round(stufe)));
  return {
    detailfragen: s <= 6 ? 2 : s <= 13 ? 3 : 4,       // Anzahl Fragen je Geschichte
    verzoegertSek: s <= 6 ? 0 : s <= 13 ? 20 : 40,    // Pause vor den Fragen (Zwischenaufgabe, hier: kurze Stille)
    zeitLimit: s <= 8 ? null : Math.max(6000, 14000 - s * 350),
  };
}

/** Eine Geschichte auswählen und deren Fragen mit vier gemischten Antworten aufbereiten. */
export function bereiteGeschichteVor(index, p, rng = Math.random) {
  const g = GESCHICHTEN[index % GESCHICHTEN.length];
  const mischen = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const fragen = mischen(g.fragen).slice(0, p.detailfragen).map((f) => ({
    frage: f.frage,
    loesung: f.loesung,
    optionen: mischen([f.loesung, ...f.ablenker]),
  }));
  return { titel: g.titel, text: g.text, fragen };
}

/** Prüft, dass jede Frage genau eine richtige Antwort unter den Optionen hat (Konsistenzprüfung, in Tests genutzt) */
export function pruefeFrage(f) {
  return f.optionen.filter((o) => o === f.loesung).length === 1 && f.optionen.length >= 3;
}

export function auswertenGeschichte(antworten) {
  const richtig = antworten.filter((a) => a.gewaehlt === a.loesung).length;
  return { gesamt: antworten.length, richtig, score: antworten.length ? richtig / antworten.length : 0 };
}

// ---------- Modul ----------

export default {
  id: "geschichte",
  bereich: "Gedächtnis",
  titel: "Kurze Geschichten",
  icon: "",
  anleitung: (stufe) => {
    const p = geschichteParameter(stufe);
    return `Sie hören oder lesen eine kurze Geschichte. Danach beantworten Sie ${p.detailfragen} Fragen dazu (Wer, Wann, Was, Wo) mit großen Antwortknöpfen.`;
  },

  async run(ctx) {
    const { stage, stufe } = ctx;
    const p = geschichteParameter(stufe);
    const index = Math.floor(Math.random() * GESCHICHTEN.length);
    const g = bereiteGeschichteVor(index, p);

    const hinweis = h("p.hinweis", { text: "" });
    const flaeche = h("div.au-gesch-flaeche");
    stage.append(hinweis, flaeche);

    let modus = await modusWahl(ctx, flaeche, "die Geschichte");
    if (modus == null || !ctx.alive()) return null;

    // Geschichte darbieten
    flaeche.replaceChildren();
    hinweis.textContent = g.titel;
    const karte = h("div.au-gesch-karte", {}, h("p.au-gesch-text", { text: g.text }));
    flaeche.append(karte);
    if (modus === "hoeren") {
      let wechsel = false;
      const lesenKnopf = h("button.knopf", { text: "Ich höre nichts – lieber lesen", onclick: debounced(() => { wechsel = true; }) });
      karte.append(h("div.knopfreihe", {}, h("span.au-modus-bild.au-gesch-spricht", { html: LAUTSPRECHER }), lesenKnopf));
      const ok = await sprichUndWarte(ctx, g.text);
      if (!ok && !wechsel) return null;
      if (wechsel && !ctx.alive()) return null;
      karte.querySelector(".knopfreihe")?.remove();
    } else {
      await sleep(Math.max(2500, g.text.length * 55));
      if (!ctx.alive()) return null;
    }

    if (p.verzoegertSek) {
      hinweis.textContent = "Kurz durchatmen …";
      karte.classList.add("au-gesch-verblasst");
      const bis = performance.now() + p.verzoegertSek * 1000;
      while (performance.now() < bis) { if (!ctx.alive()) return null; await sleep(200); }
      karte.classList.remove("au-gesch-verblasst");
    }
    karte.remove();
    if (!ctx.alive()) return null;

    // Fragen
    const antworten = [];
    hinweis.textContent = "Beantworten Sie die Fragen zur Geschichte.";
    for (let i = 0; i < g.fragen.length; i++) {
      if (!ctx.alive()) return null;
      const f = g.fragen[i];
      const gewaehlt = await frageAuswahl(ctx, flaeche, {
        frage: `${i + 1}. ${f.frage}`,
        loesung: f.loesung,
        optionen: f.optionen.map((o) => ({ inhalt: o, wert: o })),
        klasse: "au-gesch-antworten",
      });
      if (gewaehlt == null || !ctx.alive()) return null;
      antworten.push({ frage: f.frage, gewaehlt, loesung: f.loesung });
    }

    const e = auswertenGeschichte(antworten);
    let text = `${e.richtig} von ${e.gesamt} Fragen zur Geschichte „${g.titel}“ richtig beantwortet.`;
    return { score: e.score, text };
  },
};
