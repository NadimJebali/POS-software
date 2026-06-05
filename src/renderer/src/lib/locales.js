// UI translations. Keys are dot-namespaced by screen; {placeholders} are filled by t().
// English is the source of truth and the fallback for any missing key.
export const locales = {
  en: {
    common: {
      cancel: 'Cancel', save: 'Save', delete: 'Delete', close: 'Close', edit: 'Edit', add: 'Add',
      remove: 'Remove', back: 'Back', keep: 'Keep', confirm: 'Confirm', print: 'Print', upload: 'Upload',
      active: 'Active', hidden: 'Hidden', none: 'None', loading: 'Loading…', signOut: 'Sign out',
      required: 'required', error: 'Error', discard: 'Discard'
    },
    nav: {
      floor: 'Floor', menu: 'Menu', tables: 'Tables', history: 'History', analytics: 'Analytics',
      setup: 'Setup', users: 'Users', trialLeft: 'Trial — {n} day(s) left', activateHint: 'activate in Setup → License'
    },
    login: {
      title: 'Select your account to sign in', pickAccount: 'Pick an account on the left, then enter your PIN.',
      enterPinFor: 'Enter PIN for', signIn: 'Sign in', signingIn: 'Signing in…', administrator: 'Administrator',
      cashier: 'Cashier', noUsers: 'No users found.', tooMany: 'Too many attempts', lockedTryAgain: 'Locked — try again in {n}s',
      locked: 'Locked · {n}s'
    },
    floor: {
      subtitle: '{occupied} occupied · {total} tables · {open} open', addTable: 'Add table',
      noTables: 'No tables yet.', addFirst: 'Add your first table', askAdmin: 'Ask an administrator to set up the tables.',
      available: 'Available', seats: '{n} seats', items: '{n} items', couldNotAdd: 'Could not add table'
    },
    order: {
      tableTitle: 'Table {label}', tapItems: 'Tap items to add them to the ticket', noProducts: 'No products in this category.',
      options: 'options', outOfStock: 'out of stock', out: 'out', left: '{n} left', orderNum: 'Order #{id}',
      item: '{n} item', items: '{n} items', ticketEmpty: 'Ticket is empty.', total: 'Total', checkout: 'Checkout',
      eachPrice: '{price} each', cancelTitle: 'Cancel order', cancelMsg: 'Cancel this order and clear the table?',
      cancelConfirm: 'Cancel order', notEnoughStock: 'Not enough stock', lastOne: '{name} — that was the last one in stock',
      runningLow: '{name} running low — {n} left', noBarcode: 'No product for barcode {code}', chooseOptions: 'Choose options',
      chooseAny: 'choose any', chooseOne: 'choose one', addToOrder: 'Add to order', selectRequired: 'Select required options',
      itemTotal: 'Item total', noOptionsInGroup: 'No options in this group.', badgeOut: 'OUT', badgeLow: 'LOW'
    },
    checkout: {
      title: 'Checkout', total: 'Total', tendered: 'Tendered', remaining: 'Remaining', changeReturn: 'Change to return',
      amountTendered: 'Amount tendered', exact: 'Exact', addPayment: 'Add {method} payment', cash: 'Cash', card: 'Card',
      complete: 'Complete sale', completeReturn: 'Complete · return {amount}', processing: 'Processing…', left: '{amount} left',
      discount: 'Discount', custom: 'Custom', subtotal: 'Subtotal', paymentComplete: 'Payment complete', changeDue: 'Change due',
      paidByCard: 'Paid by card', paidInCash: 'Paid in cash', done: 'Done', printReceipt: 'Print receipt', cannotComplete: 'Cannot complete sale',
      customDiscount: 'Custom discount', percentage: 'Percentage', fixedAmount: 'Fixed amount', apply: 'Apply', printFailed: 'Print failed',
      percentPh: '% off (0-100)', amountPh: 'amount off', checkoutTable: 'Checkout · Table {label}'
    },
    products: {
      title: 'Menu', count: '{n} products', categories: 'Categories', allProducts: 'All products · {n}', addProduct: 'Add product',
      category: 'Category', lowWarn: '{n} product(s) are low or out of stock (threshold {t})', name: 'Name', price: 'Price',
      stockOnHand: 'Stock on hand', barcode: 'Barcode', scanOrType: 'scan or type', activeShown: 'Active (shown on order screen)',
      image: 'Product image', noImage: 'No image', newProduct: 'New product', editProduct: 'Edit product', saveFirst: 'Save the product first to add size/extra options.',
      outOfStock: 'Out of stock', inStock: '{n} in stock', left: '{n} left', status: 'Status', noProducts: 'No products yet.',
      deleteTitle: 'Delete product', deleteMsg: 'Delete “{name}”?', newCategory: 'New category', editCategory: 'Edit category', color: 'Color',
      deleteCatTitle: 'Delete category', deleteCatMsg: 'Delete category “{name}” and all its products?',
      options: 'Options (sizes / extras)', addGroup: '+ Add group', noOptions: 'No options. Add a group like “Size” or “Extras”.',
      groupName: 'Group name (e.g. Size)', requiredOpt: 'Required', allowMultiple: 'Allow multiple', multiple: 'multiple', pickOne: 'pick one',
      optionName: 'Option name', addPricePh: '+ price', addGroupBtn: 'Add group', pricePh: 'e.g. 2.500',
      deleteGroupTitle: 'Delete group', deleteGroupMsg: 'Delete this option group?',
      cols: { name: 'Name', category: 'Category', price: 'Price', stock: 'Stock', status: 'Status' }
    },
    tables: {
      title: 'Tables', subtitle: '{n} table(s) · tap to manage', addTable: 'Add table', seats: '{n} seats', available: 'available',
      occupied: 'occupied', openOrder: 'open order →', noTables: 'No tables yet. Add your first one.', edit: 'Edit',
      deleteTitle: 'Delete table', deleteMsgOpen: 'Table {label} has an open order. Delete the table and discard that order?',
      deleteMsg: 'Delete table {label}?', couldNotDelete: 'Could not delete table', couldNotSave: 'Could not save table',
      newTable: 'New table', editTable: 'Edit table', numberRef: 'Number / reference', numberPh: 'e.g. 12 or Terrace-A', seatsLabel: 'Seats'
    },
    history: {
      title: 'History', subtitle: '{n} order(s) · {total}', allTime: 'All time', noOrders: 'No orders for this period.',
      deletedBy: 'deleted by {name}', deleteTitle: 'Delete order', deleteConfirm: 'Delete order',
      deleteMsg: 'Delete this order? It stays in history marked as deleted, its stock is restored, and it no longer counts towards sales.',
      receipt: 'Receipt', servedBy: 'Served by', deleted: 'Deleted', by: 'by', reprint: 'Re-print', printing: 'Printing…',
      changeGiven: 'Change given', saveChanges: 'Save changes', noItems: 'No items recorded.', keepDisc: 'Keep', printFailed: 'Print failed',
      orderTitle: 'Order #{id}', orderTitleTable: 'Order #{id} · Table {label}', unknown: 'Unknown', discount: 'Discount', subtotal: 'Subtotal', total: 'Total',
      cols: { order: 'Order', table: 'Table', server: 'Server', time: 'Time', items: 'Items', discount: 'Discount', total: 'Total', change: 'Change' }
    },
    analytics: {
      title: 'Analytics', overview: 'Earnings overview', yourOverview: 'Your earnings overview',
      daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly',
      today: 'Today', thisWeek: 'This week', thisMonth: 'This month', thisYear: 'This year', allTime: 'All time', custom: 'Custom',
      earnings: '{period} earnings', topProducts: 'Top products', noSales: 'No sales in this period.', sold: '{n} sold',
      byServer: 'Sales by server · {period}', orders: '{n} order(s)', noData: 'No data yet.', exportPdf: 'Export PDF', exporting: 'Exporting…',
      reportSaved: 'Report saved', exportFailed: 'Export failed', exportTitle: 'Export report', exportSubtitle: 'Choose what goes in the PDF',
      dateRange: 'Date range', from: 'From', to: 'To', staff: 'Staff', allStaff: 'All staff', sections: 'Sections to include',
      secSummary: 'Summary', secTrend: 'Sales trend', secTop: 'Top products', secServer: 'Sales by server', secPayments: 'Payments'
    },
    users: {
      title: 'Users', subtitle: '{n} user(s)', addUser: 'Add user', newUser: 'New user', editUser: 'Edit user',
      username: 'Username', name: 'Display name', pin: 'PIN', role: 'Role', admin: 'Administrator', cashier: 'Cashier',
      active: 'Active', inactive: 'Disabled', deleteTitle: 'Delete user', deleteMsg: 'Delete “{name}”?',
      you: ' (you)', editUserName: 'Edit {username}', usernameSignin: 'Username (used to sign in)', pinNew: 'PIN (min 4 digits)', activeSignin: 'Active (can sign in)',
      cols: { user: 'User', name: 'Name', role: 'Role', status: 'Status', created: 'Created' }, pinHint: 'New PIN (leave blank to keep)'
    },
    settings: {
      title: 'Setup', subtitle: 'Shop, receipt, currency & printer', saved: 'Saved ✓', saveChanges: 'Save changes',
      shopInfo: 'Shop information', shopName: 'Shop name', address: 'Address', phone: 'Phone', logo: 'Logo (shown on receipt)',
      receipt: 'Receipt', footer: 'Footer message', paperWidth: 'Paper width', security: 'Security',
      autoLock: 'Auto-lock after idle minutes (0 = never)', stock: 'Stock', lowStock: 'Low-stock warning threshold',
      currency: 'Currency', symbol: 'Symbol', decimals: 'Decimals', symbolPos: 'Symbol position', preview: 'Preview',
      printer: 'Printer', receiptPrinter: 'Receipt printer', printingMode: 'Printing mode', showDialog: 'Show dialog',
      printSilently: 'Print silently', language: 'Language', languageHint: 'Changes the language across the whole app.',
      posAfter: 'After (12.500 DT)', posBefore: 'Before ($12.50)', paperWidthMm: '{w} mm',
      printerDefault: 'System default / ask each time', defaultSuffix: ' (default)',
      autoLockHint: 'When set, the app signs the current user out after this many minutes with no activity, so an unattended terminal returns to the login screen.',
      lowStockHint: 'Products with stock at or below this number are flagged as low (amber) across the app; a badge on the Menu tab shows how many need restocking. Stock is reduced automatically when a sale is completed and restored if an order is cancelled.',
      printerHint: 'Silent printing sends straight to the selected printer (best for a thermal printer). “Show dialog” lets you choose a printer or print to PDF each time.',
      backup: 'Backup & restore', backupNeedLicense: 'Database backup and restore require an active license. Activate a license to enable it.',
      backupDesc: 'Export saves a complete copy of your data — products, sales, users and settings — to a file you choose. Import replaces all current data with a backup and restarts the app.',
      exportBackup: 'Export backup', importBackup: 'Import backup', backupSaved: 'Backup saved', exportFailed: 'Export failed',
      importTitle: 'Import database', importMsg: 'This replaces ALL current data with the chosen backup and restarts the app. A copy of the current data is saved first. Continue?', importConfirm: 'Choose file & import', importFailed: 'Import failed',
      license: 'License', licLicensed: 'Licensed', licTrial: 'Trial', licUnlicensed: 'Not licensed', licExpired: 'Expired',
      daysLeft: '{n} days left', expires: 'expires {date}', machineId: 'Machine ID (send to vendor for a license)', copy: 'Copy',
      enterLicense: 'Enter / renew license', pasteLicense: 'paste license here', licenseActivated: 'License activated', activating: 'Activating…', activateLicense: 'Activate license'
    }
  },

  fr: {
    common: {
      cancel: 'Annuler', save: 'Enregistrer', delete: 'Supprimer', close: 'Fermer', edit: 'Modifier', add: 'Ajouter',
      remove: 'Retirer', back: 'Retour', keep: 'Garder', confirm: 'Confirmer', print: 'Imprimer', upload: 'Téléverser',
      active: 'Actif', hidden: 'Masqué', none: 'Aucun', loading: 'Chargement…', signOut: 'Se déconnecter',
      required: 'requis', error: 'Erreur', discard: 'Annuler'
    },
    nav: {
      floor: 'Salle', menu: 'Menu', tables: 'Tables', history: 'Historique', analytics: 'Statistiques',
      setup: 'Réglages', users: 'Utilisateurs', trialLeft: 'Essai — {n} jour(s) restant(s)', activateHint: 'activez dans Réglages → Licence'
    },
    login: {
      title: 'Sélectionnez votre compte pour vous connecter', pickAccount: 'Choisissez un compte à gauche, puis saisissez votre code PIN.',
      enterPinFor: 'Code PIN pour', signIn: 'Se connecter', signingIn: 'Connexion…', administrator: 'Administrateur',
      cashier: 'Caissier', noUsers: 'Aucun utilisateur trouvé.', tooMany: 'Trop de tentatives', lockedTryAgain: 'Bloqué — réessayez dans {n}s',
      locked: 'Bloqué · {n}s'
    },
    floor: {
      subtitle: '{occupied} occupées · {total} tables · {open} en cours', addTable: 'Ajouter une table',
      noTables: 'Aucune table.', addFirst: 'Ajoutez votre première table', askAdmin: 'Demandez à un administrateur de configurer les tables.',
      available: 'Disponible', seats: '{n} places', items: '{n} articles', couldNotAdd: "Impossible d'ajouter la table"
    },
    order: {
      tableTitle: 'Table {label}', tapItems: 'Touchez les articles pour les ajouter au ticket', noProducts: 'Aucun produit dans cette catégorie.',
      options: 'options', outOfStock: 'en rupture', out: 'rupture', left: 'reste {n}', orderNum: 'Commande #{id}',
      item: '{n} article', items: '{n} articles', ticketEmpty: 'Le ticket est vide.', total: 'Total', checkout: 'Encaisser',
      eachPrice: '{price} pièce', cancelTitle: 'Annuler la commande', cancelMsg: 'Annuler cette commande et libérer la table ?',
      cancelConfirm: 'Annuler la commande', notEnoughStock: 'Stock insuffisant', lastOne: '{name} — c’était le dernier en stock',
      runningLow: '{name} bientôt épuisé — reste {n}', noBarcode: 'Aucun produit pour le code-barres {code}', chooseOptions: 'Choisir les options',
      chooseAny: 'plusieurs choix', chooseOne: 'un choix', addToOrder: 'Ajouter à la commande', selectRequired: 'Sélectionnez les options requises',
      itemTotal: 'Total article', noOptionsInGroup: 'Aucune option dans ce groupe.', badgeOut: 'RUPT', badgeLow: 'BAS'
    },
    checkout: {
      title: 'Encaissement', total: 'Total', tendered: 'Remis', remaining: 'Restant', changeReturn: 'Monnaie à rendre',
      amountTendered: 'Montant remis', exact: 'Exact', addPayment: 'Ajouter paiement {method}', cash: 'Espèces', card: 'Carte',
      complete: 'Terminer la vente', completeReturn: 'Terminer · rendre {amount}', processing: 'Traitement…', left: 'reste {amount}',
      discount: 'Remise', custom: 'Personnalisé', subtotal: 'Sous-total', paymentComplete: 'Paiement terminé', changeDue: 'Monnaie à rendre',
      paidByCard: 'Payé par carte', paidInCash: 'Payé en espèces', done: 'Terminé', printReceipt: 'Imprimer le reçu', cannotComplete: 'Vente impossible',
      customDiscount: 'Remise personnalisée', percentage: 'Pourcentage', fixedAmount: 'Montant fixe', apply: 'Appliquer', printFailed: 'Échec de l’impression',
      percentPh: '% de remise (0-100)', amountPh: 'montant de remise', checkoutTable: 'Encaissement · Table {label}'
    },
    products: {
      title: 'Menu', count: '{n} produits', categories: 'Catégories', allProducts: 'Tous les produits · {n}', addProduct: 'Ajouter un produit',
      category: 'Catégorie', lowWarn: '{n} produit(s) en stock bas ou épuisé(s) (seuil {t})', name: 'Nom', price: 'Prix',
      stockOnHand: 'Stock disponible', barcode: 'Code-barres', scanOrType: 'scanner ou saisir', activeShown: 'Actif (visible à la commande)',
      image: 'Image du produit', noImage: 'Aucune image', newProduct: 'Nouveau produit', editProduct: 'Modifier le produit', saveFirst: 'Enregistrez d’abord le produit pour ajouter des options.',
      outOfStock: 'En rupture', inStock: '{n} en stock', left: 'reste {n}', status: 'Statut', noProducts: 'Aucun produit.',
      deleteTitle: 'Supprimer le produit', deleteMsg: 'Supprimer « {name} » ?', newCategory: 'Nouvelle catégorie', editCategory: 'Modifier la catégorie', color: 'Couleur',
      deleteCatTitle: 'Supprimer la catégorie', deleteCatMsg: 'Supprimer la catégorie « {name} » et tous ses produits ?',
      options: 'Options (tailles / extras)', addGroup: '+ Ajouter un groupe', noOptions: 'Aucune option. Ajoutez un groupe comme « Taille ».',
      groupName: 'Nom du groupe (ex. Taille)', requiredOpt: 'Requis', allowMultiple: 'Choix multiple', multiple: 'multiple', pickOne: 'un choix',
      optionName: 'Nom de l’option', addPricePh: '+ prix', addGroupBtn: 'Ajouter', pricePh: 'ex. 2.500',
      deleteGroupTitle: 'Supprimer le groupe', deleteGroupMsg: 'Supprimer ce groupe d’options ?',
      cols: { name: 'Nom', category: 'Catégorie', price: 'Prix', stock: 'Stock', status: 'Statut' }
    },
    tables: {
      title: 'Tables', subtitle: '{n} table(s) · touchez pour gérer', addTable: 'Ajouter une table', seats: '{n} places', available: 'disponible',
      occupied: 'occupée', openOrder: 'ouvrir la commande →', noTables: 'Aucune table. Ajoutez la première.', edit: 'Modifier',
      deleteTitle: 'Supprimer la table', deleteMsgOpen: 'La table {label} a une commande ouverte. Supprimer la table et annuler la commande ?',
      deleteMsg: 'Supprimer la table {label} ?', couldNotDelete: 'Impossible de supprimer la table', couldNotSave: 'Impossible d’enregistrer la table',
      newTable: 'Nouvelle table', editTable: 'Modifier la table', numberRef: 'Numéro / référence', numberPh: 'ex. 12 ou Terrasse-A', seatsLabel: 'Places'
    },
    history: {
      title: 'Historique', subtitle: '{n} commande(s) · {total}', allTime: 'Tout', noOrders: 'Aucune commande pour cette période.',
      deletedBy: 'supprimée par {name}', deleteTitle: 'Supprimer la commande', deleteConfirm: 'Supprimer',
      deleteMsg: 'Supprimer cette commande ? Elle reste dans l’historique marquée comme supprimée, son stock est restauré et elle ne compte plus dans les ventes.',
      receipt: 'Reçu', servedBy: 'Servi par', deleted: 'Supprimée', by: 'par', reprint: 'Réimprimer', printing: 'Impression…',
      changeGiven: 'Monnaie rendue', saveChanges: 'Enregistrer', noItems: 'Aucun article enregistré.', keepDisc: 'Garder', printFailed: 'Échec de l’impression',
      orderTitle: 'Commande #{id}', orderTitleTable: 'Commande #{id} · Table {label}', unknown: 'Inconnu', discount: 'Remise', subtotal: 'Sous-total', total: 'Total',
      cols: { order: 'Commande', table: 'Table', server: 'Serveur', time: 'Heure', items: 'Articles', discount: 'Remise', total: 'Total', change: 'Monnaie' }
    },
    analytics: {
      title: 'Statistiques', overview: 'Aperçu des revenus', yourOverview: 'Vos revenus',
      daily: 'Jour', weekly: 'Semaine', monthly: 'Mois', yearly: 'Année',
      today: 'Aujourd’hui', thisWeek: 'Cette semaine', thisMonth: 'Ce mois', thisYear: 'Cette année', allTime: 'Tout', custom: 'Personnalisé',
      earnings: 'Revenus — {period}', topProducts: 'Meilleurs produits', noSales: 'Aucune vente sur cette période.', sold: '{n} vendus',
      byServer: 'Ventes par serveur · {period}', orders: '{n} commande(s)', noData: 'Pas encore de données.', exportPdf: 'Exporter PDF', exporting: 'Export…',
      reportSaved: 'Rapport enregistré', exportFailed: 'Échec de l’export', exportTitle: 'Exporter le rapport', exportSubtitle: 'Choisissez le contenu du PDF',
      dateRange: 'Période', from: 'Du', to: 'Au', staff: 'Personnel', allStaff: 'Tout le personnel', sections: 'Sections à inclure',
      secSummary: 'Résumé', secTrend: 'Tendance des ventes', secTop: 'Meilleurs produits', secServer: 'Ventes par serveur', secPayments: 'Paiements'
    },
    users: {
      title: 'Utilisateurs', subtitle: '{n} utilisateur(s)', addUser: 'Ajouter', newUser: 'Nouvel utilisateur', editUser: 'Modifier l’utilisateur',
      username: 'Identifiant', name: 'Nom affiché', pin: 'Code PIN', role: 'Rôle', admin: 'Administrateur', cashier: 'Caissier',
      active: 'Actif', inactive: 'Désactivé', deleteTitle: 'Supprimer l’utilisateur', deleteMsg: 'Supprimer « {name} » ?',
      you: ' (vous)', editUserName: 'Modifier {username}', usernameSignin: 'Identifiant (pour se connecter)', pinNew: 'Code PIN (min. 4 chiffres)', activeSignin: 'Actif (peut se connecter)',
      cols: { user: 'Utilisateur', name: 'Nom', role: 'Rôle', status: 'Statut', created: 'Créé le' }, pinHint: 'Nouveau PIN (vide pour garder)'
    },
    settings: {
      title: 'Réglages', subtitle: 'Boutique, reçu, devise et imprimante', saved: 'Enregistré ✓', saveChanges: 'Enregistrer',
      shopInfo: 'Informations boutique', shopName: 'Nom de la boutique', address: 'Adresse', phone: 'Téléphone', logo: 'Logo (sur le reçu)',
      receipt: 'Reçu', footer: 'Message de pied de page', paperWidth: 'Largeur du papier', security: 'Sécurité',
      autoLock: 'Verrouillage auto après inactivité (0 = jamais)', stock: 'Stock', lowStock: 'Seuil d’alerte de stock bas',
      currency: 'Devise', symbol: 'Symbole', decimals: 'Décimales', symbolPos: 'Position du symbole', preview: 'Aperçu',
      printer: 'Imprimante', receiptPrinter: 'Imprimante de reçus', printingMode: 'Mode d’impression', showDialog: 'Afficher la boîte',
      printSilently: 'Impression silencieuse', language: 'Langue', languageHint: 'Change la langue dans toute l’application.',
      posAfter: 'Après (12.500 DT)', posBefore: 'Avant ($12.50)', paperWidthMm: '{w} mm',
      printerDefault: 'Par défaut / demander à chaque fois', defaultSuffix: ' (par défaut)',
      autoLockHint: 'Si activé, l’application déconnecte l’utilisateur après ce nombre de minutes d’inactivité, afin qu’un terminal laissé sans surveillance revienne à l’écran de connexion.',
      lowStockHint: 'Les produits dont le stock est inférieur ou égal à ce nombre sont signalés comme bas (ambre) dans toute l’application ; un badge sur l’onglet Menu indique combien doivent être réapprovisionnés. Le stock diminue automatiquement à la vente et est restauré si une commande est annulée.',
      printerHint: 'L’impression silencieuse envoie directement vers l’imprimante sélectionnée (idéal pour une imprimante thermique). « Afficher la boîte » permet de choisir une imprimante ou d’imprimer en PDF à chaque fois.',
      backup: 'Sauvegarde et restauration', backupNeedLicense: 'La sauvegarde et la restauration nécessitent une licence active. Activez une licence pour les utiliser.',
      backupDesc: 'L’export enregistre une copie complète de vos données — produits, ventes, utilisateurs et réglages — dans un fichier de votre choix. L’import remplace toutes les données actuelles par une sauvegarde et redémarre l’application.',
      exportBackup: 'Exporter la sauvegarde', importBackup: 'Importer une sauvegarde', backupSaved: 'Sauvegarde enregistrée', exportFailed: 'Échec de l’export',
      importTitle: 'Importer la base de données', importMsg: 'Ceci remplace TOUTES les données actuelles par la sauvegarde choisie et redémarre l’application. Une copie des données actuelles est enregistrée au préalable. Continuer ?', importConfirm: 'Choisir le fichier et importer', importFailed: 'Échec de l’import',
      license: 'Licence', licLicensed: 'Sous licence', licTrial: 'Essai', licUnlicensed: 'Non licencié', licExpired: 'Expirée',
      daysLeft: '{n} jours restants', expires: 'expire le {date}', machineId: 'ID machine (à envoyer au vendeur pour une licence)', copy: 'Copier',
      enterLicense: 'Saisir / renouveler la licence', pasteLicense: 'collez la licence ici', licenseActivated: 'Licence activée', activating: 'Activation…', activateLicense: 'Activer la licence'
    }
  },

  ar: {
    common: {
      cancel: 'إلغاء', save: 'حفظ', delete: 'حذف', close: 'إغلاق', edit: 'تعديل', add: 'إضافة',
      remove: 'إزالة', back: 'رجوع', keep: 'إبقاء', confirm: 'تأكيد', print: 'طباعة', upload: 'رفع',
      active: 'مفعّل', hidden: 'مخفي', none: 'بدون', loading: 'جارٍ التحميل…', signOut: 'تسجيل الخروج',
      required: 'إلزامي', error: 'خطأ', discard: 'تجاهل'
    },
    nav: {
      floor: 'القاعة', menu: 'القائمة', tables: 'الطاولات', history: 'السجل', analytics: 'الإحصائيات',
      setup: 'الإعدادات', users: 'المستخدمون', trialLeft: 'تجربة — تبقّى {n} يوم', activateHint: 'فعّل من الإعدادات ← الترخيص'
    },
    login: {
      title: 'اختر حسابك لتسجيل الدخول', pickAccount: 'اختر حسابًا من اليمين ثم أدخل الرمز السري.',
      enterPinFor: 'أدخل الرمز السري لـ', signIn: 'تسجيل الدخول', signingIn: 'جارٍ الدخول…', administrator: 'مدير',
      cashier: 'أمين صندوق', noUsers: 'لا يوجد مستخدمون.', tooMany: 'محاولات كثيرة', lockedTryAgain: 'مقفل — أعد المحاولة بعد {n} ثانية',
      locked: 'مقفل · {n} ثانية'
    },
    floor: {
      subtitle: '{occupied} مشغولة · {total} طاولة · {open} مفتوحة', addTable: 'إضافة طاولة',
      noTables: 'لا توجد طاولات.', addFirst: 'أضف أول طاولة', askAdmin: 'اطلب من المدير إعداد الطاولات.',
      available: 'متاحة', seats: '{n} مقاعد', items: '{n} عناصر', couldNotAdd: 'تعذّر إضافة الطاولة'
    },
    order: {
      tableTitle: 'طاولة {label}', tapItems: 'اضغط على العناصر لإضافتها إلى الطلب', noProducts: 'لا توجد منتجات في هذه الفئة.',
      options: 'خيارات', outOfStock: 'نفد المخزون', out: 'نفد', left: 'تبقّى {n}', orderNum: 'طلب رقم {id}',
      item: '{n} عنصر', items: '{n} عناصر', ticketEmpty: 'الطلب فارغ.', total: 'الإجمالي', checkout: 'الدفع',
      eachPrice: '{price} للوحدة', cancelTitle: 'إلغاء الطلب', cancelMsg: 'إلغاء هذا الطلب وإخلاء الطاولة؟',
      cancelConfirm: 'إلغاء الطلب', notEnoughStock: 'المخزون غير كافٍ', lastOne: '{name} — كانت آخر قطعة في المخزون',
      runningLow: '{name} يكاد ينفد — تبقّى {n}', noBarcode: 'لا يوجد منتج للباركود {code}', chooseOptions: 'اختر الخيارات',
      chooseAny: 'اختر أيًّا', chooseOne: 'اختر واحدًا', addToOrder: 'أضف إلى الطلب', selectRequired: 'اختر الخيارات المطلوبة',
      itemTotal: 'إجمالي العنصر', noOptionsInGroup: 'لا توجد خيارات في هذه المجموعة.', badgeOut: 'نفد', badgeLow: 'منخفض'
    },
    checkout: {
      title: 'الدفع', total: 'الإجمالي', tendered: 'المدفوع', remaining: 'المتبقّي', changeReturn: 'الباقي',
      amountTendered: 'المبلغ المدفوع', exact: 'بالضبط', addPayment: 'إضافة دفعة {method}', cash: 'نقدًا', card: 'بطاقة',
      complete: 'إتمام البيع', completeReturn: 'إتمام · أرجِع {amount}', processing: 'جارٍ المعالجة…', left: 'تبقّى {amount}',
      discount: 'خصم', custom: 'مخصّص', subtotal: 'المجموع الفرعي', paymentComplete: 'تم الدفع', changeDue: 'الباقي',
      paidByCard: 'مدفوع بالبطاقة', paidInCash: 'مدفوع نقدًا', done: 'تم', printReceipt: 'طباعة الإيصال', cannotComplete: 'تعذّر إتمام البيع',
      customDiscount: 'خصم مخصّص', percentage: 'نسبة مئوية', fixedAmount: 'مبلغ ثابت', apply: 'تطبيق', printFailed: 'فشلت الطباعة',
      percentPh: '٪ الخصم (0-100)', amountPh: 'مبلغ الخصم', checkoutTable: 'الدفع · طاولة {label}'
    },
    products: {
      title: 'القائمة', count: '{n} منتجات', categories: 'الفئات', allProducts: 'كل المنتجات · {n}', addProduct: 'إضافة منتج',
      category: 'الفئة', lowWarn: '{n} منتج بمخزون منخفض أو نافد (الحد {t})', name: 'الاسم', price: 'السعر',
      stockOnHand: 'المخزون المتوفر', barcode: 'الباركود', scanOrType: 'امسح أو اكتب', activeShown: 'مفعّل (يظهر في شاشة الطلب)',
      image: 'صورة المنتج', noImage: 'لا صورة', newProduct: 'منتج جديد', editProduct: 'تعديل المنتج', saveFirst: 'احفظ المنتج أولاً لإضافة الخيارات.',
      outOfStock: 'نفد المخزون', inStock: '{n} في المخزون', left: 'تبقّى {n}', status: 'الحالة', noProducts: 'لا توجد منتجات.',
      deleteTitle: 'حذف المنتج', deleteMsg: 'حذف « {name} »؟', newCategory: 'فئة جديدة', editCategory: 'تعديل الفئة', color: 'اللون',
      deleteCatTitle: 'حذف الفئة', deleteCatMsg: 'حذف الفئة « {name} » وكل منتجاتها؟',
      options: 'الخيارات (أحجام / إضافات)', addGroup: '+ إضافة مجموعة', noOptions: 'لا خيارات. أضف مجموعة مثل « الحجم ».',
      groupName: 'اسم المجموعة (مثل الحجم)', requiredOpt: 'إلزامي', allowMultiple: 'اختيار متعدّد', multiple: 'متعدّد', pickOne: 'اختيار واحد',
      optionName: 'اسم الخيار', addPricePh: '+ السعر', addGroupBtn: 'إضافة', pricePh: 'مثل 2.500',
      deleteGroupTitle: 'حذف المجموعة', deleteGroupMsg: 'حذف مجموعة الخيارات هذه؟',
      cols: { name: 'الاسم', category: 'الفئة', price: 'السعر', stock: 'المخزون', status: 'الحالة' }
    },
    tables: {
      title: 'الطاولات', subtitle: '{n} طاولة · اضغط للإدارة', addTable: 'إضافة طاولة', seats: '{n} مقاعد', available: 'متاحة',
      occupied: 'مشغولة', openOrder: 'فتح الطلب ←', noTables: 'لا توجد طاولات. أضف أول واحدة.', edit: 'تعديل',
      deleteTitle: 'حذف الطاولة', deleteMsgOpen: 'الطاولة {label} بها طلب مفتوح. حذف الطاولة وإلغاء الطلب؟',
      deleteMsg: 'حذف الطاولة {label}؟', couldNotDelete: 'تعذّر حذف الطاولة', couldNotSave: 'تعذّر حفظ الطاولة',
      newTable: 'طاولة جديدة', editTable: 'تعديل الطاولة', numberRef: 'الرقم / المرجع', numberPh: 'مثل 12 أو شرفة-أ', seatsLabel: 'المقاعد'
    },
    history: {
      title: 'السجل', subtitle: '{n} طلب · {total}', allTime: 'كل الوقت', noOrders: 'لا توجد طلبات لهذه الفترة.',
      deletedBy: 'حُذف بواسطة {name}', deleteTitle: 'حذف الطلب', deleteConfirm: 'حذف',
      deleteMsg: 'حذف هذا الطلب؟ يبقى في السجل بعلامة محذوف، ويُعاد مخزونه، ولا يُحتسب ضمن المبيعات.',
      receipt: 'إيصال', servedBy: 'قدّمه', deleted: 'محذوف', by: 'بواسطة', reprint: 'إعادة الطباعة', printing: 'جارٍ الطباعة…',
      changeGiven: 'الباقي المُعاد', saveChanges: 'حفظ التغييرات', noItems: 'لا عناصر مسجّلة.', keepDisc: 'إبقاء', printFailed: 'فشلت الطباعة',
      orderTitle: 'طلب رقم {id}', orderTitleTable: 'طلب رقم {id} · طاولة {label}', unknown: 'غير معروف', discount: 'الخصم', subtotal: 'المجموع الفرعي', total: 'الإجمالي',
      cols: { order: 'الطلب', table: 'الطاولة', server: 'الموظف', time: 'الوقت', items: 'العناصر', discount: 'الخصم', total: 'الإجمالي', change: 'الباقي' }
    },
    analytics: {
      title: 'الإحصائيات', overview: 'نظرة على الأرباح', yourOverview: 'أرباحك',
      daily: 'يومي', weekly: 'أسبوعي', monthly: 'شهري', yearly: 'سنوي',
      today: 'اليوم', thisWeek: 'هذا الأسبوع', thisMonth: 'هذا الشهر', thisYear: 'هذه السنة', allTime: 'كل الوقت', custom: 'مخصّص',
      earnings: 'الأرباح — {period}', topProducts: 'أفضل المنتجات', noSales: 'لا مبيعات في هذه الفترة.', sold: 'بيع {n}',
      byServer: 'المبيعات حسب الموظف · {period}', orders: '{n} طلب', noData: 'لا توجد بيانات بعد.', exportPdf: 'تصدير PDF', exporting: 'جارٍ التصدير…',
      reportSaved: 'تم حفظ التقرير', exportFailed: 'فشل التصدير', exportTitle: 'تصدير التقرير', exportSubtitle: 'اختر محتوى الملف',
      dateRange: 'الفترة', from: 'من', to: 'إلى', staff: 'الموظف', allStaff: 'كل الموظفين', sections: 'الأقسام المضمّنة',
      secSummary: 'ملخّص', secTrend: 'اتجاه المبيعات', secTop: 'أفضل المنتجات', secServer: 'المبيعات حسب الموظف', secPayments: 'المدفوعات'
    },
    users: {
      title: 'المستخدمون', subtitle: '{n} مستخدم', addUser: 'إضافة', newUser: 'مستخدم جديد', editUser: 'تعديل المستخدم',
      username: 'اسم المستخدم', name: 'الاسم المعروض', pin: 'الرمز السري', role: 'الدور', admin: 'مدير', cashier: 'أمين صندوق',
      active: 'مفعّل', inactive: 'معطّل', deleteTitle: 'حذف المستخدم', deleteMsg: 'حذف « {name} »؟',
      you: ' (أنت)', editUserName: 'تعديل {username}', usernameSignin: 'اسم المستخدم (لتسجيل الدخول)', pinNew: 'الرمز السري (4 أرقام على الأقل)', activeSignin: 'مفعّل (يمكنه تسجيل الدخول)',
      cols: { user: 'المستخدم', name: 'الاسم', role: 'الدور', status: 'الحالة', created: 'أُنشئ في' }, pinHint: 'رمز جديد (اتركه فارغًا للإبقاء)'
    },
    settings: {
      title: 'الإعدادات', subtitle: 'المتجر والإيصال والعملة والطابعة', saved: 'تم الحفظ ✓', saveChanges: 'حفظ التغييرات',
      shopInfo: 'معلومات المتجر', shopName: 'اسم المتجر', address: 'العنوان', phone: 'الهاتف', logo: 'الشعار (يظهر على الإيصال)',
      receipt: 'الإيصال', footer: 'رسالة التذييل', paperWidth: 'عرض الورق', security: 'الأمان',
      autoLock: 'القفل التلقائي بعد دقائق خمول (0 = أبدًا)', stock: 'المخزون', lowStock: 'حدّ التنبيه لانخفاض المخزون',
      currency: 'العملة', symbol: 'الرمز', decimals: 'المنازل العشرية', symbolPos: 'موضع الرمز', preview: 'معاينة',
      printer: 'الطابعة', receiptPrinter: 'طابعة الإيصالات', printingMode: 'وضع الطباعة', showDialog: 'إظهار النافذة',
      printSilently: 'طباعة صامتة', language: 'اللغة', languageHint: 'تغيّر لغة التطبيق بالكامل.',
      posAfter: 'بعد (12.500 DT)', posBefore: 'قبل ($12.50)', paperWidthMm: '{w} مم',
      printerDefault: 'الافتراضي / السؤال في كل مرة', defaultSuffix: ' (افتراضي)',
      autoLockHint: 'عند التفعيل، يُسجّل التطبيق خروج المستخدم الحالي بعد هذا العدد من دقائق الخمول، فيعود الطرفية غير المراقبة إلى شاشة تسجيل الدخول.',
      lowStockHint: 'المنتجات التي يساوي مخزونها هذا الحد أو يقل عنه تُعلَّم كمنخفضة (كهرماني) في كل التطبيق؛ وتعرض شارة في تبويب القائمة عدد ما يحتاج إعادة تخزين. يُخصم المخزون تلقائيًا عند إتمام البيع ويُعاد عند إلغاء الطلب.',
      printerHint: 'الطباعة الصامتة تُرسل مباشرة إلى الطابعة المحددة (الأفضل للطابعة الحرارية). «إظهار النافذة» يتيح اختيار طابعة أو الطباعة إلى PDF في كل مرة.',
      backup: 'النسخ الاحتياطي والاستعادة', backupNeedLicense: 'يتطلب النسخ الاحتياطي والاستعادة ترخيصًا فعّالًا. فعّل ترخيصًا لتمكينه.',
      backupDesc: 'يحفظ التصدير نسخة كاملة من بياناتك — المنتجات والمبيعات والمستخدمين والإعدادات — في ملف تختاره. يستبدل الاستيراد كل البيانات الحالية بنسخة احتياطية ويعيد تشغيل التطبيق.',
      exportBackup: 'تصدير نسخة احتياطية', importBackup: 'استيراد نسخة احتياطية', backupSaved: 'تم حفظ النسخة الاحتياطية', exportFailed: 'فشل التصدير',
      importTitle: 'استيراد قاعدة البيانات', importMsg: 'سيستبدل هذا كل البيانات الحالية بالنسخة المختارة ويعيد تشغيل التطبيق. تُحفظ نسخة من البيانات الحالية أولاً. متابعة؟', importConfirm: 'اختر الملف واستورد', importFailed: 'فشل الاستيراد',
      license: 'الترخيص', licLicensed: 'مُرخّص', licTrial: 'تجربة', licUnlicensed: 'غير مُرخّص', licExpired: 'منتهٍ',
      daysLeft: 'تبقّى {n} يوم', expires: 'ينتهي في {date}', machineId: 'معرّف الجهاز (أرسله للبائع للحصول على ترخيص)', copy: 'نسخ',
      enterLicense: 'إدخال / تجديد الترخيص', pasteLicense: 'الصق الترخيص هنا', licenseActivated: 'تم تفعيل الترخيص', activating: 'جارٍ التفعيل…', activateLicense: 'تفعيل الترخيص'
    }
  }
}

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' }
]
