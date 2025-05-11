import axios from "axios";

export const uploadImage = async (token, form) => {
  return await axios.post(
    "http://localhost:3000/api/images",
    {
      image: form,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};
