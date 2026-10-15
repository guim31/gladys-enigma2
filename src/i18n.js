// -----------------------------------------------------------------------------
// Every text the code produces, in the four languages of the Gladys interface.
// German says "du", Spanish "usted". The vocabulary follows the Gladys
// interface (front/src/config/i18n): "Kanal", "Lautstärke", "Canal"...
//
// A device integration does not receive the user's language: the feature
// names and the texts published as states use the `language` setting; the
// widget receives the dashboard language with each request.
// -----------------------------------------------------------------------------

export const LANGS = ['en', 'fr', 'de', 'es'];

/** Language of a request, English when unknown. */
export const langOf = (language) => (LANGS.includes(language) ? language : 'en');

/** Feature names, by feature key (fixed when the user adds the device). */
export const NAMES = {
  en: {
    power: 'Power (on / standby)',
    volume: 'Volume',
    volume_up: 'Volume up',
    volume_down: 'Volume down',
    mute: 'Mute',
    channel_up: 'Next channel',
    channel_down: 'Previous channel',
    channel_previous: 'Last channel',
    channel_number: 'Channel number',
    channel_list: 'Favourite channels',
    channel_name: 'Current channel',
    program_now: 'Current programme',
    program_next: 'Next programme',
    recording: 'Recording in progress',
  },
  fr: {
    power: 'Marche / veille',
    volume: 'Volume',
    volume_up: 'Augmenter le volume',
    volume_down: 'Diminuer le volume',
    mute: 'Muet',
    channel_up: 'Chaîne suivante',
    channel_down: 'Chaîne précédente',
    channel_previous: 'Dernière chaîne',
    channel_number: 'Numéro de chaîne',
    channel_list: 'Chaînes favorites',
    channel_name: 'Chaîne en cours',
    program_now: 'Programme en cours',
    program_next: 'Programme suivant',
    recording: 'Enregistrement en cours',
  },
  de: {
    power: 'Ein / Standby',
    volume: 'Lautstärke',
    volume_up: 'Lautstärke höher',
    volume_down: 'Lautstärke niedriger',
    mute: 'Stumm',
    channel_up: 'Nächster Kanal',
    channel_down: 'Voriger Kanal',
    channel_previous: 'Letzter Kanal',
    channel_number: 'Kanalnummer',
    channel_list: 'Lieblingskanäle',
    channel_name: 'Aktueller Kanal',
    program_now: 'Aktuelle Sendung',
    program_next: 'Nächste Sendung',
    recording: 'Aufnahme läuft',
  },
  es: {
    power: 'Encendido / reposo',
    volume: 'Volumen',
    volume_up: 'Subir volumen',
    volume_down: 'Bajar volumen',
    mute: 'Silenciar',
    channel_up: 'Canal siguiente',
    channel_down: 'Bajar canal',
    channel_previous: 'Último canal',
    channel_number: 'Número de canal',
    channel_list: 'Canales favoritos',
    channel_name: 'Canal actual',
    program_now: 'Programa actual',
    program_next: 'Programa siguiente',
    recording: 'Grabación en curso',
  },
};

/** Short texts: published as text states, and shown in the widget. */
export const TEXT = {
  en: {
    none: 'None',
    standby: 'Standby',
    on: 'On',
    unreachable: 'Unreachable',
    noProgram: 'No programme guide',
    recordingPlayback: 'Recording',
    state: 'State',
    recording: 'Recording',
    muted: 'Sound',
    yes: 'Yes',
    no: 'No',
    soundOn: 'On',
    soundOff: 'Muted',
    next: 'Next:',
    power: 'On / standby',
    channelDown: 'Channel −',
    channelUp: 'Channel +',
    mute: 'Mute',
    volume: 'Volume',
  },
  fr: {
    none: 'Aucune',
    standby: 'En veille',
    on: 'Allumé',
    unreachable: 'Injoignable',
    noProgram: 'Pas de guide des programmes',
    recordingPlayback: 'Enregistrement',
    state: 'État',
    recording: 'Enregistrement',
    muted: 'Son',
    yes: 'Oui',
    no: 'Non',
    soundOn: 'Actif',
    soundOff: 'Coupé',
    next: 'Ensuite :',
    power: 'Marche / veille',
    channelDown: 'Chaîne −',
    channelUp: 'Chaîne +',
    mute: 'Muet',
    volume: 'Volume',
  },
  de: {
    none: 'Keine',
    standby: 'Standby',
    on: 'Ein',
    unreachable: 'Nicht erreichbar',
    noProgram: 'Kein Programmführer',
    recordingPlayback: 'Aufnahme',
    state: 'Status',
    recording: 'Aufnahme',
    muted: 'Ton',
    yes: 'Ja',
    no: 'Nein',
    soundOn: 'An',
    soundOff: 'Stumm',
    next: 'Danach:',
    power: 'Ein / Standby',
    channelDown: 'Kanal −',
    channelUp: 'Kanal +',
    mute: 'Stumm',
    volume: 'Lautstärke',
  },
  es: {
    none: 'Ninguno',
    standby: 'En reposo',
    on: 'Encendido',
    unreachable: 'Inaccesible',
    noProgram: 'Sin guía de programas',
    recordingPlayback: 'Grabación',
    state: 'Estado',
    recording: 'Grabación',
    muted: 'Sonido',
    yes: 'Sí',
    no: 'No',
    soundOn: 'Activo',
    soundOff: 'Silenciado',
    next: 'Después:',
    power: 'Encendido / reposo',
    channelDown: 'Canal −',
    channelUp: 'Canal +',
    mute: 'Silenciar',
    volume: 'Volumen',
  },
};

/** Multi-language messages: connection status, action results, widget states. */
export const MESSAGES = {
  initFailed: {
    en: 'Initialization failed, check the integration logs.',
    fr: "L'initialisation a échoué, consultez les journaux de l'intégration.",
    de: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
    es: 'La inicialización ha fallado, consulte los registros de la integración.',
  },
  notConfigured: {
    en: 'Enter the address of a receiver in the configuration.',
    fr: "Saisissez l'adresse d'un démodulateur dans la configuration.",
    de: 'Gib in der Konfiguration die Adresse eines Receivers ein.',
    es: 'Introduzca la dirección de un receptor en la configuración.',
  },
  invalidAddress: {
    en: 'An address cannot be read: IP or name, optional https:// and :port.',
    fr: 'Une adresse est illisible : IP ou nom, https:// et :port facultatifs.',
    de: 'Eine Adresse ist ungültig: IP oder Name, https:// und :Port optional.',
    es: 'Una dirección no es válida: IP o nombre, https:// y :puerto opcionales.',
  },
  authRefused: {
    en: 'A receiver refuses the user or password: check them in the configuration.',
    fr: "Un démodulateur refuse l'utilisateur ou le mot de passe : vérifiez-les dans la configuration.",
    de: 'Ein Receiver lehnt Benutzer oder Passwort ab: Prüfe sie in der Konfiguration.',
    es: 'Un receptor rechaza el usuario o la contraseña: compruébelos en la configuración.',
  },
  noneReachable: {
    en: 'No receiver answers: check the address and that OpenWebif is running.',
    fr: "Aucun démodulateur ne répond : vérifiez l'adresse et qu'OpenWebif est actif.",
    de: 'Kein Receiver antwortet: Prüfe die Adresse und ob OpenWebif läuft.',
    es: 'Ningún receptor responde: compruebe la dirección y que OpenWebif esté activo.',
  },
  unknownReceiver: {
    en: 'Unknown receiver: pick one of the integration devices.',
    fr: "Démodulateur inconnu : choisissez un appareil de l'intégration.",
    de: 'Unbekannter Receiver: Wähle ein Gerät der Integration.',
    es: 'Receptor desconocido: elija un dispositivo de la integración.',
  },
  receiverUnreachable: {
    en: 'The receiver does not answer (off, deep standby or network).',
    fr: 'Le démodulateur ne répond pas (éteint, veille profonde ou réseau).',
    de: 'Der Receiver antwortet nicht (aus, Deep-Standby oder Netzwerk).',
    es: 'El receptor no responde (apagado, reposo profundo o red).',
  },
  unknownChannel: {
    en: 'Channel not found in the favourites bouquet.',
    fr: 'Chaîne introuvable dans le bouquet des favoris.',
    de: 'Kanal nicht im Favoriten-Bouquet gefunden.',
    es: 'Canal no encontrado en el bouquet de favoritos.',
  },
  emptyMessage: {
    en: 'The message is empty.',
    fr: 'Le message est vide.',
    de: 'Die Nachricht ist leer.',
    es: 'El mensaje está vacío.',
  },
  chooseReceiver: {
    en: 'Choose a receiver in the widget settings.',
    fr: 'Choisissez un démodulateur dans les réglages du widget.',
    de: 'Wähle in den Widget-Einstellungen einen Receiver.',
    es: 'Elija un receptor en los ajustes del widget.',
  },
  done: {
    en: 'Done',
    fr: 'Fait',
    de: 'Erledigt',
    es: 'Hecho',
  },
};

/** Pick one language of a multi-language message. */
export const pick = (message, language) => message[langOf(language)] ?? message.en;

/** The report of the "Test the receivers" action, one table per language. */
export const REPORT_TEXT = {
  en: {
    none: 'No receiver configured: enter an address.',
    invalid: (slots) => `Address ${slots} cannot be read.`,
    receiver: (slot, host) => `Receiver ${slot} (${host})`,
    answers: (name, webif) => `${name}${webif ? `, ${webif}` : ''}`,
    channels: (count, bouquet) => `${count} channel(s) in "${bouquet}"`,
    noBouquet: 'no TV bouquet',
    refused: 'user or password refused',
    silent: 'does not answer (off, deep standby, address or OpenWebif)',
  },
  fr: {
    none: 'Aucun démodulateur configuré : saisissez une adresse.',
    invalid: (slots) => `Adresse ${slots} illisible.`,
    receiver: (slot, host) => `Démodulateur ${slot} (${host})`,
    answers: (name, webif) => `${name}${webif ? `, ${webif}` : ''}`,
    channels: (count, bouquet) => `${count} chaîne(s) dans « ${bouquet} »`,
    noBouquet: 'aucun bouquet TV',
    refused: 'utilisateur ou mot de passe refusé',
    silent: 'ne répond pas (éteint, veille profonde, adresse ou OpenWebif)',
  },
  de: {
    none: 'Kein Receiver konfiguriert: Gib eine Adresse ein.',
    invalid: (slots) => `Adresse ${slots} ist ungültig.`,
    receiver: (slot, host) => `Receiver ${slot} (${host})`,
    answers: (name, webif) => `${name}${webif ? `, ${webif}` : ''}`,
    channels: (count, bouquet) => `${count} Kanal/Kanäle in „${bouquet}“`,
    noBouquet: 'kein TV-Bouquet',
    refused: 'Benutzer oder Passwort abgelehnt',
    silent: 'antwortet nicht (aus, Deep-Standby, Adresse oder OpenWebif)',
  },
  es: {
    none: 'Ningún receptor configurado: introduzca una dirección.',
    invalid: (slots) => `La dirección ${slots} no es válida.`,
    receiver: (slot, host) => `Receptor ${slot} (${host})`,
    answers: (name, webif) => `${name}${webif ? `, ${webif}` : ''}`,
    channels: (count, bouquet) => `${count} canal(es) en «${bouquet}»`,
    noBouquet: 'ningún bouquet de TV',
    refused: 'usuario o contraseña rechazados',
    silent: 'no responde (apagado, reposo profundo, dirección u OpenWebif)',
  },
};

/** The test report, in every language. */
export function testReport(summary) {
  return Object.fromEntries(
    LANGS.map((lang) => {
      const t = REPORT_TEXT[lang];
      const lines = [];
      if (summary.receivers.length === 0 && summary.invalidSlots.length === 0) {
        lines.push(t.none);
      }
      if (summary.invalidSlots.length > 0) {
        lines.push(t.invalid(summary.invalidSlots.join(', ')));
      }
      for (const receiver of summary.receivers) {
        let detail;
        if (receiver.authRefused) {
          detail = t.refused;
        } else if (!receiver.answered) {
          detail = t.silent;
        } else {
          detail = `${t.answers(receiver.name, receiver.webif)}, ${
            receiver.bouquet ? t.channels(receiver.channels, receiver.bouquet) : t.noBouquet
          }`;
        }
        lines.push(`${t.receiver(receiver.slot, receiver.host)}: ${detail}.`);
      }
      return [lang, lines.join(' ')];
    }),
  );
}
