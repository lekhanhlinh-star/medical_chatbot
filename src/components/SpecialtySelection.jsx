import { useState } from 'react'
import './SpecialtySelection.css'

function SpecialtySelection({ onSelect }) {
  const specialties = [
    {
      id: 'gdm',
      title: 'GDM: 妊娠期糖尿病教案',
      image: 'https://img.freepik.com/premium-photo/young-asian-male-doctor-hospital_880492-1521.jpg',
      doctorImage: 'https://img.freepik.com/premium-photo/young-asian-male-doctor-hospital_880492-1521.jpg',
      roleName: '藥劑師',
      roleType: 'pharmacist',
      roleGender: 'male'
    },
    {
      id: 'ppd',
      title: 'PPD: 產後憂鬱症教案',
      image: 'https://img.freepik.com/premium-photo/portrait-smiling-young-asian-doctor-hospital-hallway_917313-8837.jpg',
      doctorImage: 'https://img.freepik.com/premium-photo/portrait-smiling-young-asian-doctor-hospital-hallway_917313-8837.jpg',
      roleName: '藥劑師',
      roleType: 'pharmacist',
      roleGender: 'male'
    },
    {
      id: 'ckd',
      title: 'CKD: 慢性腎臟病教案',
      image: 'https://img.freepik.com/premium-photo/young-asian-female-doctor_1114244-555.jpg',
      doctorImage: 'https://img.freepik.com/premium-photo/young-asian-female-doctor_1114244-555.jpg',
      roleName: '藥劑師',
      roleType: 'pharmacist',
      roleGender: 'male'
    }
  ]

  const handleSelectSpecialty = (specialty) => {
    console.log('Specialty selected:', specialty.id)
    
    // Save to localStorage (matching original HTML behavior)
    localStorage.setItem('selectedSpecialty', specialty.id)
    localStorage.setItem('selectedDoctor', specialty.doctorImage)
    localStorage.setItem('selectedRole', specialty.roleType)
     localStorage.setItem('selectedRoleName', specialty.roleName)
     // save default gender for the role
     if (specialty.roleGender) {
       localStorage.setItem('selectedGender', specialty.roleGender)
     }
    
    // Notify parent component
    onSelect()
  }

  return (
    <div className="specialty-container">
      <div className="specialty-content">
        <h1>選擇跨領域團隊合作照護教案</h1>
        
        <div className="specialty-list">
          {specialties.map(specialty => (
            <div 
              key={specialty.id}
              className="specialty-item"
              onClick={() => handleSelectSpecialty(specialty)}
            >
              <img 
                src={specialty.image} 
                alt={specialty.roleName} 
                className="specialty-avatar"
              />
              <div className="specialty-info">
                <h3>{specialty.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SpecialtySelection
