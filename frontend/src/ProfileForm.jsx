import { useState } from "react";

export default function ProfileForm() {

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    experience: ""
  });

  const saveProfile = () => {
    chrome.storage.local.set({ profile });
    alert("Profile Saved!");
  };

  return (
    <div>
      {Object.keys(profile).map(key => (
        <input
          key={key}
          placeholder={key}
          onChange={(e) =>
            setProfile({ ...profile, [key]: e.target.value })
          }
        />
      ))}

      <button onClick={saveProfile}>
        Save Profile
      </button>
    </div>
  );
}