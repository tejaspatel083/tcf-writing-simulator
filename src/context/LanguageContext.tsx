import React, { createContext, useContext, useState } from 'react';

export type Language = 'fr' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (keyOrText: string) => string;
}

const keyMap: Record<string, { fr: string; en: string }> = {
  'header.home': { fr: 'Accueil', en: 'Home' },
  'header.title': { fr: 'TCF Canada Expression Écrite', en: 'TCF Canada Written Expression' },
  'header.dashboard': { fr: 'Tableau de bord', en: 'Dashboard' },
  'header.logout': { fr: 'Déconnexion', en: 'Log out' },
  'header.login': { fr: 'Se connecter', en: 'Log in' }
};

const directFrenchToEnglish: Record<string, string> = {
  // Navigation & General
  "Accueil": "Home",
  "← Accueil": "← Home",
  "Tableau de bord": "Dashboard",
  "Tableau de bord utilisateur": "User Dashboard",
  "Déconnexion": "Log out",
  "Se connecter": "Log in",
  "Se connecter / Créer un compte": "Log in / Register",
  "Retour à l'accueil": "Back to Home",
  "← Retour au tableau de bord / accueil": "← Back to Dashboard / Home",
  "Quitter": "Exit",
  "Supprimer": "Delete",
  "Voir": "View",
  "Date": "Date",
  "Année": "Year",
  "Mois": "Month",
  "Combinaison": "Combination",
  "Série / Combinaison": "Exam Set / Combination",
  "Actions": "Actions",
  "Pratique": "Practice",
  "Pratique ciblée :": "Targeted practice:",
  "Combinaisons rapides :": "Quick combinations:",
  "Tâches sélectionnées :": "Selected tasks:",
  "Copier mes rédactions": "Copy my writings",
  "Non évalué": "Not evaluated",
  "mots": "words",
  "inclus": "inclusive",
  "(inclus)": "(inclusive)",
  "mots inclus": "words inclusive",
  "mots (inclus)": "words (inclusive)",
  "Copié !": "Copied!",
  "Copier": "Copy",
  "Copier l'exemple": "Copy example",
  "Copier ma réponse": "Copy my answer",
  "Copier toutes mes réponses": "Copy all my answers",
  "📋 Copier toutes mes réponses": "📋 Copy all my answers",
  "Fermer": "Close",
  "Suivant": "Next",
  "Terminer": "Finish",
  "Annuler": "Cancel",
  "Confirmer": "Confirm",
  "Examen terminé": "Exam Completed",
  "Temps utilisé": "Time used",
  "Compte-rendu de votre session": "Session Summary",
  "Examen en cours": "Exam in Progress",

  // Months
  "Janvier": "January",
  "Février": "February",
  "Mars": "March",
  "Avril": "April",
  "Mai": "May",
  "Juin": "June",
  "Juillet": "July",
  "Août": "August",
  "Septembre": "September",
  "Octobre": "October",
  "Novembre": "November",
  "Décembre": "December",

  // Home Page
  "TCF Canada — Expression Écrite Simulator": "TCF Canada — Written Expression Simulator",
  "Entraînez-vous dans les conditions de l'examen réel.": "Practice under real exam conditions.",
  "Mon Dashboard (Mes soumissions) →": "My Dashboard (My Submissions) →",
  "Choisissez votre entraînement": "Choose your practice session",
  "Sélectionnez une session d'entraînement": "Select a practice session",
  "Choisissez une combinaison réelle d'examen TCF Canada pour vous entraîner dans les conditions officielles.": "Choose a real TCF Canada exam combination to practice under official conditions.",
  "Vous n'êtes pas connecté. Connectez-vous pour synchroniser vos examens avec Supabase.": "You are not logged in. Log in to sync your exams with Supabase.",
  "Commencer l'examen": "Start Exam",
  "Refaire cet examen": "Retake this exam",
  "Refaire l’examen": "Retake exam",
  "Commencer": "Start",
  "Durée : 60 minutes • 3 tâches obligatoires": "Duration: 60 minutes • 3 mandatory tasks",
  "Durée: 60 minutes": "Duration: 60 minutes",
  "Sessions disponibles": "Available sessions",
  "Combinaisons du mois": "Combinations of the month",
  "Session": "Session",
  "Prêt pour l'épreuve ?": "Ready for the exam?",
  "Vous êtes prêt à commencer l'examen ?": "Are you ready to start the exam?",
  "Vous aurez 60 minutes pour compléter les 3 tâches dans les conditions réelles.": "You will have 60 minutes to complete all 3 tasks under real exam conditions.",
  "L'examen dure 60 minutes au total pour les 3 tâches. Le chronomètre démarre dès la validation.": "The exam lasts 60 minutes in total for all 3 tasks. The timer starts as soon as you confirm.",
  "Confirmer et démarrer": "Confirm and start",
  "Mode Examen Réel": "Real Exam Mode",
  "Conditions officielles TCF Canada": "Official TCF Canada Conditions",
  "Évaluation IA & Banque d'Erreurs": "AI Evaluation & Mistake Bank",
  "Profil Coach Personnalisé": "Personalized Coach Profile",
  "Tâche 1 : Message (60 - 120 mots)": "Task 1: Message (60 - 120 words)",
  "Tâche 2 : Récit / Article (120 - 150 mots)": "Task 2: Story / Article (120 - 150 words)",
  "Tâche 3 : Essai argumenté (120 - 180 mots)": "Task 3: Opinion Essay (120 - 180 words)",
  "Tâche 1 — Message": "Task 1 — Message",
  "Tâche 2 — Récit / Article": "Task 2 — Story / Article",
  "Tâche 3 — Essai argumenté": "Task 3 — Opinion Essay",
  "Tâche 1 — Message (60–120 mots)": "Task 1 — Message (60–120 words)",
  "Tâche 2 — Narration (120–150 mots)": "Task 2 — Story (120–150 words)",
  "Tâche 3 — Argumentation (120–180 mots)": "Task 3 — Opinion Essay (120–180 words)",
  "Tâche 1": "Task 1",
  "Tâche 2": "Task 2",
  "Tâche 3": "Task 3",
  "Déjà complétée (Refaire disponible)": "Already completed (Retake available)",
  "Déjà complétée": "Already completed",
  "Déjà faite (Refaire disponible)": "Already completed (Retake available)",
  "Faite": "Completed",
  "Sélectionnée": "Selected",
  "Consulter vos soumissions passées": "View your past submissions",
  "Retrouvez l'historique complet de vos épreuves, vos décomptes de mots et vos rédactions dans votre tableau de bord personnel.": "Find your full exam history, word counts, and writing submissions in your personal dashboard.",
  "Accéder au Dashboard": "Go to Dashboard",

  // Single Task Mode & Custom Timer
  "Mode d'entraînement": "Training Mode",
  "Examen complet de 60 minutes avec les 3 tâches consécutives (conditions réelles).": "Full 60-minute exam with all 3 consecutive tasks (official conditions).",
  "Entraînement ciblé sur une seule tâche avec un minuteur personnalisé défini par vous-même.": "Targeted practice on a single task with a custom timer defined by yourself.",
  "Examen Complet (60 min)": "Full Exam (60 min)",
  "Pratique par Tâche": "Task Practice",
  "1. Choisissez la tâche à pratiquer": "1. Choose the task to practice",
  "(Question issue de la combinaison sélectionnée)": "(Question from the selected combination)",
  "Message / Description": "Message / Description",
  "Narration / Récit": "Story / Narration",
  "Argumentation (2 documents)": "Opinion Essay (2 documents)",
  "Temps recommandé :": "Recommended time:",
  "Temps conseillé :": "Recommended time:",
  "2. Fixez votre minuteur (Temps libre par vous-même)": "2. Set your custom timer (Choose your own time)",
  "Minuteur réglé :": "Configured timer:",
  "minutes": "minutes",
  "Raccourcis :": "Presets:",
  "Pratique individuelle :": "Individual Practice:",
  "Tâche :": "Task:",
  "Minuteur personnalisé :": "Custom timer:",
  "Conditions réelles :": "Real conditions:",
  "Conditions réelles": "Official conditions",
  "Commencer l'entraînement": "Start practice",
  "Démarrer l'entraînement": "Start practice",
  "Pratique libre": "Free practice",
  "Entraînement Pratique": "Practice Session",
  "Examen Complet": "Full Exam",
  "Examen Officiel": "Official Exam",
  "Examen officiel terminé": "Official Exam Completed",
  "Compte-rendu d'entraînement": "Practice Report",
  "Compte-rendu d'entraînement individuel": "Individual practice summary",
  "Compte-rendu de l'Examen": "Exam Report",
  "Compte-rendu": "Report",
  "Voici le récapitulatif de votre session. Vous pouvez copier votre texte pour l'évaluer ou le conserver.": "Here is the summary of your session. You can copy your text to review or keep.",
  "Entraînement individuel": "Individual practice",
  "Nombre de mots": "Word count",
  "Objectif exigé": "Required target",
  "✓ Conforme": "✓ Compliant",
  "⚠️ Non conforme": "⚠️ Non-compliant",
  "Copier ma rédaction": "Copy my text",
  "Question au hasard": "Random question",
  "Terminer l'entraînement": "Finish practice",
  "Refaire la Combinaison": "Retake Combination",
  "Vous avez déjà soumis cette combinaison auparavant. Vous pouvez la refaire dans les conditions réelles (60 minutes). Votre nouvelle soumission sera enregistrée séparément dans votre tableau de bord.": "You have previously submitted this combination. You can retake it under real exam conditions (60 minutes). Your new submission will be saved separately in your dashboard.",
  "Vous pouvez la refaire à tout moment pour vous réentraîner. Votre nouvelle tentative sera enregistrée séparément dans votre tableau de bord.": "You can retake it anytime to practice again. Your new attempt will be recorded separately in your dashboard.",

  // Dashboard & Mistake Bank
  "Bienvenue": "Welcome",
  "Compte candidat :": "Candidate account:",
  "Ma Banque d'Erreurs & Profil Coach": "My Mistake Bank & Coach Profile",
  "Mes examens précédents": "My Past Exam Submissions",
  "Total erreurs répertoriées": "Total recorded mistakes",
  "TOTAL ERREURS RÉPERTORIÉES": "TOTAL RECORDED MISTAKES",
  "Lancer 10 min d'entraînement": "Start 10 min practice",
  "Lancer 10 min d'entraînement ciblé": "Start 10 min targeted practice",
  "ERREUR DE LA SEMAINE CIBLÉE": "TARGET MISTAKE OF THE WEEK",
  "Erreur de la semaine ciblée": "Target Mistake of the Week",
  "Pratiquer maintenant (5 questions) →": "Practice now (5 questions) →",
  "S'entraîner maintenant (5 questions) →": "Practice now (5 questions) →",
  "Banque d'erreurs par catégorie": "Mistake Bank by Category",
  "Cliquez sur une catégorie pour filtrer vos erreurs et voir les sous-catégories associées.": "Click a category to filter your mistakes and see related subcategories.",
  "Afficher toutes les catégories": "Show all categories",
  "Vos 5 axes prioritaires": "Your 5 Priority Areas",
  "Top 5 faiblesses récurrentes": "Top 5 Recurring Weaknesses",
  "À travailler": "To practice",
  "Maîtrise des compétences": "Skill Mastery",
  "Progression": "Progress",
  "Compétences à consolider pour le niveau B2": "Skills to strengthen for B2 level",
  "Plus grande progression observée": "Greatest Observed Improvement",
  "Erreurs résolues avec succès sur les dernières sessions.": "Errors successfully resolved across recent sessions.",
  "Filtre actif :": "Active filter:",
  "Toutes les erreurs répertoriées": "All recorded mistakes",
  "Liste de vos erreurs": "List of your mistakes",
  "Aucune faute répertoriée dans cette catégorie. Excellent travail !": "No mistakes recorded in this category. Excellent work!",
  "Aucune erreur enregistrée pour cette catégorie. Continuez vos rédactions !": "No mistakes recorded for this category. Keep writing!",
  "Historique des examens": "Exam History",
  "Retrouvez vos écrits, vos temps et vos évaluations complètes.": "Find your written tasks, times, and complete evaluations.",
  "Aucun examen enregistré pour le moment. Lancez votre première session !": "No exams recorded yet. Start your first session!",
  "+ Commencer un nouvel examen": "+ Start a new exam",
  "Mois / Année": "Month / Year",
  "Mots écrits (T1 / T2 / T3)": "Words written (T1 / T2 / T3)",
  "Évaluation IA": "AI Evaluation",
  "Voulez-vous vraiment supprimer cette soumission": "Are you sure you want to delete this submission",

  // Results Page
  "Consultez vos écrits ou lancez l'évaluation détaillée par le Coach IA TCF Canada.": "Review your written tasks or launch detailed feedback from the AI TCF Canada Coach.",
  "Évaluer avec l’IA (Coach TCF)": "Evaluate with AI (TCF Coach)",
  "Évaluation en cours...": "Evaluation in progress...",
  "Aperçu de vos rédactions": "Your Written Tasks Preview",
  "Vous pouvez copier vos réponses ci-dessous ou lancer l'évaluation détaillée avec le bouton ci-dessus.": "You can copy your answers below or launch the detailed evaluation with the button above.",
  "Analyse en cours par l'expert TCF Canada...": "Analysis in progress by TCF Canada expert...",
  "Identification des fautes par catégorie, vérification du respect des consignes et estimation du niveau CECRL/NCLC (environ 3 secondes).": "Identifying mistakes by category, checking compliance with instructions, and estimating CEFR/NCLC level (approx. 3 seconds).",
  "Réessayer": "Retry",
  "Erreur lors de l'évaluation :": "Error during evaluation:",
  "Entraînement terminé": "Practice Completed",
  "Voici le récapitulatif de votre rédaction sur cette tâche. Vous pouvez copier votre texte pour l'évaluer ou le conserver.": "Here is the summary of your writing for this task. You can copy your text to review or save it.",
  "Voici le récapitulatif complet de vos réponses pour évaluation avec votre tuteur.": "Here is the complete summary of your answers for evaluation with your tutor.",
  "Copier tout pour mon tuteur": "Copy all for my tutor",
  "Copier cette tâche": "Copy this task",
  "Aucune réponse rédigée.": "No response written.",

  // Simulator, Editor & Submission Panel
  "Temps restant": "Time remaining",
  "Tableau de caractère": "Special characters",
  "Majuscules": "Uppercase",
  "Minuscules": "Lowercase",
  "MAJ (Actif)": "CAPS (Active)",
  "Passer en majuscules (ex: É, À)": "Switch to uppercase (e.g. É, À)",
  "Passer en minuscules": "Switch to lowercase",
  "Insérer": "Insert",
  "Conditions de soumission": "Submission conditions",
  "Précédent": "Previous",
  "Terminer l'examen": "Finish exam",
  "Terminer cet entraînement ?": "Finish this practice?",
  "Voulez-vous vraiment terminer l'examen ?": "Do you really want to finish the exam?",
  "Vous ne pourrez plus modifier votre réponse pour cette tâche.": "You will no longer be able to edit your response for this task.",
  "Vous ne pourrez plus modifier vos réponses une fois la soumission validée.": "You will no longer be able to edit your answers once submitted.",
  "⏱️ Temps écoulé ! La rédaction est désormais bloquée.": "⏱️ Time's up! Writing is now locked.",
  "Veuillez cliquer sur \"Terminer l'examen\" ci-dessous.": "Please click on \"Finish exam\" below.",
  "Veuillez rédiger votre texte ci-dessous.": "Please write your text below.",
  "Saisissez votre texte ici...": "Type your text here...",
  "Temps écoulé — Rédaction désactivée.": "Time's up — Writing disabled.",
  "✓ Nombre de mots conforme": "✓ Word count compliant",
  "⚠️ Nombre de mots insuffisant": "⚠️ Insufficient word count",
  "⚠️ Limite dépassée": "⚠️ Word limit exceeded",
  "Description / Message": "Description / Message",
  "Argumentation": "Opinion Essay",
  "Entraînement": "Practice",
  "Tâches": "Tasks",

  // Footer, Developer Info & Feedback
  "⚠️ Avis important :": "⚠️ Important Notice:",
  "Ce site est uniquement un outil de pratique pour l'entraînement à l'écriture. Aucun droit d'auteur revendiqué — créé bénévolement pour aider les étudiants.": "This site is solely a practice tool for writing preparation. No copyright claimed — created voluntarily to help students.",
  "Conditions d'utilisation / Disclaimer": "Terms of Use / Disclaimer",
  "Développé bénévolement par": "Developed voluntarily by",
  "Contact & Remerciements :": "Contact & Feedback:",
  "Remerciements & Feedback": "Thanks & Feedback",
  "Un mot pour le développeur / Feedback": "A note for the developer / Feedback",
  "Envoyer un feedback ou des remerciements": "Send feedback or a thank-you note",
  "Feedback": "Feedback",
  "Développeur": "Developer",
  "Concepteur et développeur de cette plateforme de préparation au TCF Canada.": "Designer and developer of this TCF Canada practice platform.",
  "Écrire un e-mail direct": "Send a direct email",
  "Pourquoi ce site ?": "Why this website?",
  "Ce simulateur a été créé bénévolement dans le but d'aider tous les étudiants et candidats à s'entraîner gratuitement dans les conditions réelles de l'examen d'expression écrite du TCF Canada.": "This simulator was built voluntarily to help all candidates practice for free under real TCF Canada written exam conditions.",
  "Merci infiniment pour votre message !": "Thank you so much for your message!",
  "Votre retour a bien été transmis à": "Your message has been sent to",
  "Chaque message, encouragement ou suggestion compte énormément pour faire évoluer ce simulateur.": "Every message, kind word, or suggestion helps make this platform better.",
  "Envoyer un autre mot": "Send another message",
  "Envoyer un message ou vos remerciements": "Send a message or your thanks",
  "Ce formulaire sera transmis directement sur la boîte mail de Tejas Patel": "This form will be sent directly to Tejas Patel's inbox",
  "Objet de votre message": "Message Topic",
  "Remerciements": "Thanks & Praise",
  "Suggestion": "Suggestion",
  "Signaler bug": "Report bug",
  "Votre appréciation de la plateforme": "Your rating of the platform",
  "Parfait / Très utile": "Perfect / Very helpful",
  "Très bon outil": "Great tool",
  "Peut être amélioré": "Could be improved",
  "Besoin de corrections": "Needs fixes",
  "Votre nom ou prénom": "Your name",
  "optionnel": "optional",
  "Votre adresse e-mail": "Your email address",
  "si vous souhaitez une réponse": "if you would like a reply",
  "Titre / Objet": "Title / Subject",
  "Votre message": "Your message",
  "Envoyer mon message à Tejas": "Send my message to Tejas",
  "Ou envoyer directement via votre boîte mail": "Or send directly via your email app",

  // AI Evaluation View
  "Bilan Coach IA — TCF Canada": "AI Coach Assessment — TCF Canada",
  "estimé": "estimated",
  "Évaluation pédagogique indicative personnalisée basée sur vos rédactions.": "Indicative personalized educational assessment based on your writing.",
  "Commentaire général du Coach :": "Coach's Overall Feedback:",
  "Cap vers le niveau": "On track for level",
  "acquis": "acquired",
  "Axes prioritaires pour sécuriser le B2 :": "Priority areas to secure B2 level:",
  "Points forts démontrés :": "Demonstrated Strengths:",
  "Points prioritaires à consolider :": "Priority Areas to Strengthen:",
  "🎯 Compétence clé à travailler en priorité": "🎯 Key Skill to Work on in Priority",
  "📚 Entraînement recommandé": "📚 Recommended Practice",
  "faute": "mistake",
  "fautes": "mistakes",
  "Niveau estimé tâche :": "Estimated task level:",
  "Sujet & Consigne officielle": "Official Topic & Prompt",
  "SUJET & CONSIGNE OFFICIELLE": "OFFICIAL TOPIC & PROMPT",
  "Consigne :": "Prompt:",
  "Document 1 :": "Document 1:",
  "Document 2 :": "Document 2:",
  "Votre réponse rédigée": "Your Written Response",
  "Aucune réponse rédigée pour cette tâche.": "No response submitted for this task.",
  "Exemple de réponse modèle (Générée par l'IA)": "Model Answer Example (AI Generated)",
  "Niveau B2 Avancé / C1": "Advanced B2 / C1 Level",
  "📋 Copier l'exemple": "📋 Copy example",
  "Avant vs Après : comparaison directe": "Before vs After: Direct Comparison",
  "❌ Votre texte original :": "❌ Your original text:",
  "✅ Formulation B2/C1 améliorée :": "✅ Improved B2/C1 formulation:",
  "Explication détaillée des modifications :": "Detailed explanation of changes:",
  "📊 Grille d'évaluation détaillée de la tâche": "📊 Detailed Task Scoring Grid",
  "Grille d'évaluation détaillée de la tâche": "Detailed Task Scoring Grid",
  "Grammaire": "Grammar",
  "Vocabulaire": "Vocabulary",
  "Orthographe": "Spelling",
  "Temps verbaux": "Verb Tenses",
  "Structure de phrases": "Sentence Structure",
  "Cohérence & Connecteurs": "Coherence & Connectors",
  "Respect consigne": "Task Completion",
  "Score Global": "Overall Score",
  "🔍 Fautes identifiées": "🔍 Identified Mistakes",
  "Fautes identifiées": "Identified Mistakes",
  "✓ Aucune faute grammaticale ou lexicale significative relevée sur cette tâche. Très bon travail !": "✓ No significant grammatical or lexical mistakes found on this task. Great job!",
  "Texte original :": "Original text:",
  "Correction recommandée :": "Recommended correction:",
  "Rule / Explanation :": "Rule / Explanation:",
  "💡 Suggestions de style & tournures B2/C1": "💡 Style Suggestions & B2/C1 Phrasing",
  "Suggestions de style & tournures B2/C1": "Style Suggestions & B2/C1 Phrasing",
  "Votre phrase :": "Your sentence:",
  "Formulation plus naturelle / B2+ :": "More natural / B2+ phrasing:",
  "Critique": "Critical",
  "Majeure": "Major",
  "Mineure": "Minor",
  "🔴 Nouveau": "🔴 New",
  "🟠 En pratique": "🟠 In practice",
  "🟢 En progrès": "🟢 Improving",
  "✅ Maîtrisé": "✅ Mastered",
  "Conforme": "Compliant",
  "Mots insuffisants": "Insufficient words",
  "Limite dépassée": "Limit exceeded",

  // Practice Modal
  "Entraînement Ciblé Coach IA": "AI Coach Targeted Practice",
  "ENTRAÎNEMENT CIBLÉ COACH IA": "AI COACH TARGETED PRACTICE",
  "Question": "Question",
  "Bonne réponse !": "Correct answer!",
  "Explication :": "Explanation:",
  "Réponse incorrecte": "Incorrect answer",
  "Question suivante →": "Next question →",
  "Voir mon bilan d'entraînement": "View practice summary",
  "Entraînement terminé !": "Practice Completed!",
  "Score final :": "Final Score:",
  "Excellente maîtrise ! Vous avez consolidé cette notion clé.": "Excellent mastery! You have consolidated this key concept.",
  "Bon entraînement. Révisez encore cette notion pour la sécuriser.": "Good practice. Review this concept again to secure it.",
  "Fermer l'entraînement": "Close practice",
  "Entraînement TCF Canada": "TCF Canada Practice",

  // Login Page
  "Connexion": "Log In",
  "Inscription": "Sign Up",
  "Connexion candidat": "Candidate Login",
  "Créer un compte": "Create an account",
  "Mot de passe oublié": "Forgot password",
  "Nouveau mot de passe": "New password",
  "Créez votre compte unique. Une vérification par e-mail est obligatoire avant votre premier accès.": "Create your unique account. Email verification is required before your first login.",
  "Connectez-vous avec votre adresse e-mail vérifiée pour accéder au simulateur TCF.": "Log in with your verified email to access the TCF simulator.",
  "Saisissez votre adresse e-mail pour recevoir les instructions de réinitialisation.": "Enter your email address to receive reset instructions.",
  "Choisissez un mot de passe sécurisé pour réactiver l’accès à votre compte.": "Choose a secure password to restore access to your account.",
  "Adresse email": "Email address",
  "Adresse e-mail": "Email address",
  "Mot de passe": "Password",
  "Confirmer le mot de passe": "Confirm password",
  "Se souvenir de moi sur cet appareil": "Remember me on this device",
  "Mot de passe oublié ?": "Forgot password?",
  "Créer mon compte": "Create my account",
  "Renvoyer l'e-mail de confirmation": "Resend confirmation email",
  "Envoyer les instructions": "Send instructions",
  "Enregistrement du mot de passe...": "Saving password...",
  "Envoi en cours...": "Sending...",
  "Connexion en cours...": "Logging in...",
  "Création en cours...": "Creating account...",
  "Enregistrer le nouveau mot de passe": "Save new password",
  "Retour à la connexion": "Back to login",
  "Bienvenue sur votre simulateur TCF Canada": "Welcome to your TCF Canada simulator",
  "Pas encore de compte ? S'inscrire": "Don't have an account yet? Sign up",
  "Déjà un compte ? Se connecter": "Already have an account? Log in",
  "Accès obligatoire par authentification": "Mandatory authenticated access",
  "Configuration de l'IA (Google Gemini)": "AI Configuration (Google Gemini)",
  "Évaluation automatique & Coaching TCF Canada": "Automatic Evaluation & TCF Canada Coaching",
  "100% Gratuit & Sécurisé en local": "100% Free & Secure Locally",
  "L'API Google Gemini 1.5 Flash est gratuite jusqu'à 1 500 évaluations par jour. Votre clé reste strictement enregistrée sur votre navigateur localement.": "The Google Gemini 1.5 Flash API is free up to 1,500 evaluations per day. Your key remains strictly stored locally in your browser.",
  "→ Obtenir ma clé gratuite sur Google AI Studio (2 min) ↗": "→ Get my free key on Google AI Studio (2 min) ↗",
  "Clé API Gemini (Google AI Studio)": "Gemini API Key (Google AI Studio)",
  "Vous pouvez aussi renseigner VITE_GEMINI_API_KEY dans votre fichier .env.": "You can also set VITE_GEMINI_API_KEY in your .env file.",
  "Supprimer la clé": "Delete key",
  "Enregistrer la clé": "Save key",
  "✓ Enregistré !": "✓ Saved!"
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'fr',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (keyOrText: string) => keyOrText
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('tcf_language');
      return (saved === 'en' || saved === 'fr') ? saved : 'fr';
    } catch {
      return 'fr';
    }
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('tcf_language', lang);
    } catch {}
  };

  const toggleLanguage = () => {
    setLanguage(language === 'fr' ? 'en' : 'fr');
  };

  const t = (keyOrText: string): string => {
    if (!keyOrText) return '';

    // Handle key-based lookups (e.g. 'header.home')
    if (keyMap[keyOrText]) {
      return keyMap[keyOrText][language];
    }

    if (language === 'fr') {
      return keyOrText;
    }

    const trimmed = keyOrText.trim();
    if (directFrenchToEnglish[trimmed]) {
      return directFrenchToEnglish[trimmed];
    }

    // Dynamic / Pattern-based translation
    if (trimmed.startsWith('Combinaison ')) {
      return trimmed.replace('Combinaison', 'Combination');
    }
    if (trimmed.startsWith('Tâche ')) {
      return trimmed.replace('Tâche', 'Task');
    }
    if (trimmed.startsWith('Mois (')) {
      return trimmed.replace('Mois', 'Month');
    }
    if (trimmed.startsWith('Fait le ')) {
      return trimmed.replace('Fait le', 'Completed on');
    }
    if (trimmed.startsWith('Question ')) {
      return trimmed;
    }
    if (trimmed.endsWith(' mots')) {
      return trimmed.replace('mots', 'words');
    }
    if (trimmed.includes('combinaison')) {
      return trimmed.replace(/combinaisons?/g, (m) => (m.endsWith('s') ? 'combinations' : 'combination'));
    }
    if (trimmed.includes('faite')) {
      return trimmed.replace(/faites?/g, 'done');
    }

    // Check without punctuation or leading emojis
    const cleanKey = trimmed.replace(/^[^\w\s\u00C0-\u017F]+/, '').trim();
    if (directFrenchToEnglish[cleanKey]) {
      return directFrenchToEnglish[cleanKey];
    }

    return keyOrText;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
