import './Sidebar.css'

function Sidebar({ isVisible, onSelectCharacter }) {
  // Get selected specialty from localStorage
  const selectedSpecialty = localStorage.getItem('selectedSpecialty') || 'gdm'
  
  // Define characters for each specialty
  const charactersBySpecialty = {
    ppd: [
      { src: 'https://img.freepik.com/premium-photo/young-asian-male-doctor-hospital_880492-1521.jpg', alt: '藥劑師', role: 'pharmacist', gender: 'male' },
      { src: 'https://img.freepik.com/premium-photo/portrait-smiling-young-asian-doctor-hospital-hallway_917313-8837.jpg', alt: '精神科醫師', role: 'psychiatrist', gender: 'male' },
      { src: 'https://img.freepik.com/premium-photo/young-asian-female-doctor_1114244-555.jpg', alt: '心理諮商師', role: 'counselor', gender: 'female' },
      { src: 'https://img.freepik.com/premium-photo/asian-woman-doctor-with-stethoscope-hospital_1009902-10009.jpg', alt: '社工師', role: 'social_worker', gender: 'female' }
    ],
    gdm: [
      { src: 'https://img.freepik.com/premium-photo/young-asian-male-doctor-hospital_880492-1521.jpg', alt: '藥劑師', role: 'pharmacist', gender: 'male' },
      { src: 'https://img.freepik.com/premium-photo/young-asian-female-doctor_1114244-555.jpg', alt: '營養師', role: 'dietitian', gender: 'female' }
    ],
    ckd: [
      { src: 'https://img.freepik.com/premium-photo/portrait-smiling-young-asian-doctor-hospital-hallway_917313-8837.jpg', alt: '藥劑師', role: 'pharmacist', gender: 'male' },
      { src: 'https://img.freepik.com/premium-photo/young-asian-male-doctor-hospital_880492-1521.jpg', alt: '營養師', role: 'dietitian', gender: 'female' }
    ]
  }
  
  // Get characters for current specialty
  const characters = charactersBySpecialty[selectedSpecialty] || charactersBySpecialty.gdm

  return (
    <aside className={`sidebar ${isVisible ? '' : 'hidden'}`}>
      <h2>選擇要諮商的虛擬醫事人員</h2>
      <div className="character-list">
        {characters.map((char, index) => (
          <div
            key={index}
            className="character-item"
            onClick={() => onSelectCharacter(char.src, char.role, char.gender)}
          >
            <img
              src={char.src}
              alt={char.alt}
              className="thumbnail"
            />
            <p className="character-name">{char.alt}</p>
          </div>
        ))}
      </div>
    </aside>
  )
}

export default Sidebar
