// EchoWorld companion client for Unity. Drop into Assets/, add to a GameObject, fill in the Inspector fields.
//
// The AI itself is not in this file: it runs on the EchoWorld server (/api/companion), which holds the
// Gemini key and does the player search. Unity only signs the player in and sends chat messages.
// Never put the Gemini key or the Supabase secret key in a Unity project; the publishable key is fine.
//
// Usage:
//   var echo = GetComponent<EchoCompanionClient>();
//   yield return echo.SignIn(email, password, error => { if (error != null) Debug.LogError(error); });
//   yield return echo.Ask("Find someone from Manchester who studies maths.",
//       r => { Debug.Log(r.reply); foreach (var p in r.players) Debug.Log(p.displayName + " @" + p.username); },
//       error => Debug.LogError(error));

using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

public class EchoCompanionClient : MonoBehaviour
{
    [Tooltip("Where the EchoWorld server runs: http://localhost:5173 in dev, your Vercel URL when deployed.")]
    [SerializeField] string apiBaseUrl = "http://localhost:5173";
    [Tooltip("https://<project-ref>.supabase.co")]
    [SerializeField] string supabaseUrl = "";
    [Tooltip("Supabase publishable (anon) key. NOT the secret key.")]
    [SerializeField] string supabasePublishableKey = "";

    [Serializable] public class ChatTurn { public string role; public string text; }

    /// <summary>A player from search. Fields the player does not share are null or empty.</summary>
    [Serializable] public class Player
    {
        public string id, username, displayName, city, university, subject, bio;
        public string[] interests;
    }

    [Serializable] public class Reply
    {
        public string reply;
        public Player[] players = new Player[0]; // real database rows, never invented by the AI
        public string mode;                      // "live", or "dev" when the server has no Gemini key
        public string error, message;            // set only on failure
    }

    [Serializable] class CompanionRequest { public string message; public List<ChatTurn> history; }
    [Serializable] class SignInRequest { public string email; public string password; }
    [Serializable] class SignInResponse { public string access_token, error_description, msg; }

    const int MaxHistory = 10; // server accepts 12
    readonly List<ChatTurn> history = new List<ChatTurn>();
    string accessToken;

    public bool IsSignedIn { get { return !string.IsNullOrEmpty(accessToken); } }

    /// <summary>Signs in with a Supabase email/password account. onDone gets null on success, else an error.</summary>
    // shortcut: no token refresh, so the session ends after about an hour; call SignIn again on "sign in again".
    public IEnumerator SignIn(string email, string password, Action<string> onDone)
    {
        var url = supabaseUrl.TrimEnd('/') + "/auth/v1/token?grant_type=password";
        var body = JsonUtility.ToJson(new SignInRequest { email = email, password = password });
        using (var req = PostJson(url, body))
        {
            req.SetRequestHeader("apikey", supabasePublishableKey);
            yield return req.SendWebRequest();

            if (req.result == UnityWebRequest.Result.ConnectionError) { onDone("Can't reach Supabase. Check your connection."); yield break; }
            var res = ParseOrDefault<SignInResponse>(req.downloadHandler.text);
            if (req.responseCode != 200 || string.IsNullOrEmpty(res.access_token))
            {
                onDone(FirstNonEmpty(res.error_description, res.msg, "Sign-in failed (" + req.responseCode + ")."));
                yield break;
            }
            accessToken = res.access_token;
            onDone(null);
        }
    }

    public void SignOut() { accessToken = null; history.Clear(); }

    /// <summary>Sends a message to the companion. Exactly one of onReply / onError is called.</summary>
    public IEnumerator Ask(string message, Action<Reply> onReply, Action<string> onError)
    {
        var body = JsonUtility.ToJson(new CompanionRequest { message = message, history = history });
        using (var req = PostJson(apiBaseUrl.TrimEnd('/') + "/api/companion", body))
        {
            if (IsSignedIn) req.SetRequestHeader("Authorization", "Bearer " + accessToken);
            yield return req.SendWebRequest();

            if (req.result == UnityWebRequest.Result.ConnectionError) { onError("Can't reach EchoWorld. Check your connection."); yield break; }
            var res = ParseOrDefault<Reply>(req.downloadHandler.text);
            if (req.responseCode != 200 || !string.IsNullOrEmpty(res.error))
            {
                if (req.responseCode == 401) accessToken = null; // expired or missing: caller should sign in again
                onError(FirstNonEmpty(res.message, "Server error (" + req.responseCode + ")."));
                yield break;
            }

            history.Add(new ChatTurn { role = "user", text = message });
            history.Add(new ChatTurn { role = "assistant", text = res.reply });
            if (history.Count > MaxHistory) history.RemoveRange(0, history.Count - MaxHistory);
            if (res.players == null) res.players = new Player[0];
            onReply(res);
        }
    }

    static UnityWebRequest PostJson(string url, string json)
    {
        var req = new UnityWebRequest(url, "POST");
        req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(json));
        req.downloadHandler = new DownloadHandlerBuffer();
        req.SetRequestHeader("Content-Type", "application/json");
        req.timeout = 30;
        return req;
    }

    // Error pages are not always JSON; fall back to an empty object rather than throwing.
    static T ParseOrDefault<T>(string json) where T : new()
    {
        try { return JsonUtility.FromJson<T>(json) ?? new T(); }
        catch (ArgumentException) { return new T(); }
    }

    static string FirstNonEmpty(params string[] values)
    {
        foreach (var v in values) if (!string.IsNullOrEmpty(v)) return v;
        return "";
    }
}
