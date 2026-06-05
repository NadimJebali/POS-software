// UI translations. Keys are dot-namespaced by screen; {placeholders} are filled by t().
// English is the source of truth and the fallback for any missing key.
export const locales = {
  en: {
    common: {
      cancel: 'Cancel', save: 'Save', delete: 'Delete', close: 'Close', edit: 'Edit', add: 'Add',
      remove: 'Remove', back: 'Back', keep: 'Keep', confirm: 'Confirm', print: 'Print', upload: 'Upload',
      active: 'Active', hidden: 'Hidden', none: 'None', loading: 'Loading…', signOut: 'Sign out'
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
      itemTotal: 'Item total'
    },
    checkout: {
      title: 'Checkout', tendered: 'Tendered', remaining: 'Remaining', changeReturn: 'Change to return',
      amountTendered: 'Amount tendered', exact: 'Exact', addPayment: 'Add {method} payment', cash: 'Cash', card: 'Card',
      complete: 'Complete sale', completeReturn: 'Complete · return {amount}', processing: 'Processing…', left: '{amount} left',
      discount: 'Discount', custom: 'Custom', subtotal: 'Subtotal', paymentComplete: 'Payment complete', changeDue: 'Change due',
      paidByCard: 'Paid by card', paidInCash: 'Paid in cash', done: 'Done', printReceipt: 'Print receipt', cannotComplete: 'Cannot complete sale',
      customDiscount: 'Custom discount', percentage: 'Percentage', fixedAmount: 'Fixed amount', apply: 'Apply'
    },
    settings: {
      title: 'Setup', subtitle: 'Shop, receipt, currency & printer', saved: 'Saved ✓', saveChanges: 'Save changes',
      shopInfo: 'Shop information', shopName: 'Shop name', address: 'Address', phone: 'Phone', logo: 'Logo (shown on receipt)',
      receipt: 'Receipt', footer: 'Footer message', paperWidth: 'Paper width', security: 'Security',
      autoLock: 'Auto-lock after idle minutes (0 = never)', stock: 'Stock', lowStock: 'Low-stock warning threshold',
      currency: 'Currency', symbol: 'Symbol', decimals: 'Decimals', symbolPos: 'Symbol position', preview: 'Preview',
      printer: 'Printer', receiptPrinter: 'Receipt printer', printingMode: 'Printing mode', showDialog: 'Show dialog',
      printSilently: 'Print silently', language: 'Language', languageHint: 'Changes the language across the whole app.'
    }
  },

  fr: {
    common: {
      cancel: 'Annuler', save: 'Enregistrer', delete: 'Supprimer', close: 'Fermer', edit: 'Modifier', add: 'Ajouter',
      remove: 'Retirer', back: 'Retour', keep: 'Garder', confirm: 'Confirmer', print: 'Imprimer', upload: 'Téléverser',
      active: 'Actif', hidden: 'Masqué', none: 'Aucun', loading: 'Chargement…', signOut: 'Se déconnecter'
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
      itemTotal: 'Total article'
    },
    checkout: {
      title: 'Encaissement', tendered: 'Remis', remaining: 'Restant', changeReturn: 'Monnaie à rendre',
      amountTendered: 'Montant remis', exact: 'Exact', addPayment: 'Ajouter paiement {method}', cash: 'Espèces', card: 'Carte',
      complete: 'Terminer la vente', completeReturn: 'Terminer · rendre {amount}', processing: 'Traitement…', left: 'reste {amount}',
      discount: 'Remise', custom: 'Personnalisé', subtotal: 'Sous-total', paymentComplete: 'Paiement terminé', changeDue: 'Monnaie à rendre',
      paidByCard: 'Payé par carte', paidInCash: 'Payé en espèces', done: 'Terminé', printReceipt: 'Imprimer le reçu', cannotComplete: 'Vente impossible',
      customDiscount: 'Remise personnalisée', percentage: 'Pourcentage', fixedAmount: 'Montant fixe', apply: 'Appliquer'
    },
    settings: {
      title: 'Réglages', subtitle: 'Boutique, reçu, devise et imprimante', saved: 'Enregistré ✓', saveChanges: 'Enregistrer',
      shopInfo: 'Informations boutique', shopName: 'Nom de la boutique', address: 'Adresse', phone: 'Téléphone', logo: 'Logo (sur le reçu)',
      receipt: 'Reçu', footer: 'Message de pied de page', paperWidth: 'Largeur du papier', security: 'Sécurité',
      autoLock: 'Verrouillage auto après inactivité (0 = jamais)', stock: 'Stock', lowStock: 'Seuil d’alerte de stock bas',
      currency: 'Devise', symbol: 'Symbole', decimals: 'Décimales', symbolPos: 'Position du symbole', preview: 'Aperçu',
      printer: 'Imprimante', receiptPrinter: 'Imprimante de reçus', printingMode: 'Mode d’impression', showDialog: 'Afficher la boîte',
      printSilently: 'Impression silencieuse', language: 'Langue', languageHint: 'Change la langue dans toute l’application.'
    }
  },

  ar: {
    common: {
      cancel: 'إلغاء', save: 'حفظ', delete: 'حذف', close: 'إغلاق', edit: 'تعديل', add: 'إضافة',
      remove: 'إزالة', back: 'رجوع', keep: 'إبقاء', confirm: 'تأكيد', print: 'طباعة', upload: 'رفع',
      active: 'مفعّل', hidden: 'مخفي', none: 'بدون', loading: 'جارٍ التحميل…', signOut: 'تسجيل الخروج'
    },
    nav: {
      floor: 'القاعة', menu: 'القائمة', tables: 'الطاولات', history: 'السجل', analytics: 'الإحصائيات',
      setup: 'الإعدادات', users: 'المستخدمون', trialLeft: 'تجربة — تبقّى {n} يوم', activateHint: 'فعّل من الإعدادات ← الترخيص'
    },
    login: {
      title: 'اختر حسابك لتسجيل الدخول', pickAccount: 'اختر حسابًا من اليسار ثم أدخل الرمز السري.',
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
      itemTotal: 'إجمالي العنصر'
    },
    checkout: {
      title: 'الدفع', tendered: 'المدفوع', remaining: 'المتبقّي', changeReturn: 'الباقي',
      amountTendered: 'المبلغ المدفوع', exact: 'بالضبط', addPayment: 'إضافة دفعة {method}', cash: 'نقدًا', card: 'بطاقة',
      complete: 'إتمام البيع', completeReturn: 'إتمام · أرجِع {amount}', processing: 'جارٍ المعالجة…', left: 'تبقّى {amount}',
      discount: 'خصم', custom: 'مخصّص', subtotal: 'المجموع الفرعي', paymentComplete: 'تم الدفع', changeDue: 'الباقي',
      paidByCard: 'مدفوع بالبطاقة', paidInCash: 'مدفوع نقدًا', done: 'تم', printReceipt: 'طباعة الإيصال', cannotComplete: 'تعذّر إتمام البيع',
      customDiscount: 'خصم مخصّص', percentage: 'نسبة مئوية', fixedAmount: 'مبلغ ثابت', apply: 'تطبيق'
    },
    settings: {
      title: 'الإعدادات', subtitle: 'المتجر والإيصال والعملة والطابعة', saved: 'تم الحفظ ✓', saveChanges: 'حفظ التغييرات',
      shopInfo: 'معلومات المتجر', shopName: 'اسم المتجر', address: 'العنوان', phone: 'الهاتف', logo: 'الشعار (يظهر على الإيصال)',
      receipt: 'الإيصال', footer: 'رسالة التذييل', paperWidth: 'عرض الورق', security: 'الأمان',
      autoLock: 'القفل التلقائي بعد دقائق خمول (0 = أبدًا)', stock: 'المخزون', lowStock: 'حدّ التنبيه لانخفاض المخزون',
      currency: 'العملة', symbol: 'الرمز', decimals: 'المنازل العشرية', symbolPos: 'موضع الرمز', preview: 'معاينة',
      printer: 'الطابعة', receiptPrinter: 'طابعة الإيصالات', printingMode: 'وضع الطباعة', showDialog: 'إظهار النافذة',
      printSilently: 'طباعة صامتة', language: 'اللغة', languageHint: 'تغيّر لغة التطبيق بالكامل.'
    }
  }
}

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' }
]
