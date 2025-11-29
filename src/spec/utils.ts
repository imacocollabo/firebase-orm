export async function cleanTables() {
    await fetch(
        `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents`,
        {
            method: 'DELETE',
        },
    );
}
