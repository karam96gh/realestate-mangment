// controllers/realEstateUnit.controller.js - النسخة المحدثة مع معالجة إنشاء طلب الصيانة

const RealEstateUnit = require('../models/realEstateUnit.model');
const Building = require('../models/building.model');
const Company = require('../models/company.model');
const Reservation = require('../models/reservation.model');
const ServiceOrder = require('../models/serviceOrder.model');
const User = require('../models/user.model');
const { catchAsync, AppError } = require('../utils/errorHandler');
const { Op } = require('sequelize');

// ✅ دالة مساعدة للتحقق من إنشاء طلب الصيانة يدوياً (في حالة فشل Hook)
const ensureMaintenanceOrder = async (unitId, transaction = null) => {
  try {
    const unit = await RealEstateUnit.findByPk(unitId, { transaction });
    
    if (!unit || unit.status !== 'maintenance') {
      return null;
    }
    
    // البحث عن الحجز النشط
    // const activeReservation = await Reservation.findOne({
    //   where: {
    //     unitId: unit.id,
    //     status: 'active'
    //   },
    //   transaction
    // });
    
    // if (!activeReservation) {
    //   console.log(`⚠️ لا يوجد حجز نشط للوحدة ${unit.unitNumber} - لا يمكن إنشاء طلب صيانة`);
    //   return null;
    // }
    
    // التحقق من عدم وجود طلب صيانة مفتوح
    const existingMaintenanceOrder = await ServiceOrder.findOne({
      where: {
        reservationId: activeReservation.id,
        serviceType: 'maintenance',
        status: {
          [Op.in]: ['pending', 'in-progress']
        }
      },
      transaction
    });
    
    if (existingMaintenanceOrder) {
      console.log(`⚠️ يوجد طلب صيانة مفتوح بالفعل للوحدة ${unit.unitNumber}`);
      return existingMaintenanceOrder;
    }
    
    // إنشاء طلب صيانة جديد
    const maintenanceOrder = await ServiceOrder.create({
      userId: activeReservation.userId,
      reservationId: activeReservation.id,
      serviceType: 'maintenance',
      serviceSubtype: 'general_maintenance',
      description: `طلب صيانة تلقائي للوحدة ${unit.unitNumber} - تم تحديد حالة الوحدة إلى "تحت الصيانة"`,
      status: 'pending',
      serviceHistory: [{
        status: 'pending',
        date: new Date().toISOString(),
        changedBy: 'system',
        changedByRole: 'system',
        changedByName: 'النظام الآلي',
        note: 'طلب صيانة تلقائي عند تحديث حالة الوحدة'
      }]
    }, { transaction });
    
    console.log(`✅ تم إنشاء طلب صيانة ${maintenanceOrder.id} للوحدة ${unit.unitNumber}`);
    return maintenanceOrder;
    
  } catch (error) {
    console.error(`❌ خطأ في إنشاء طلب صيانة للوحدة ${unitId}:`, error);
    return null;
  }
};

// تحديث دالة updateUnit مع معالجة إضافية لطلبات الصيانة
// إضافة هذا التحقق في دالة updateUnit في controllers/realEstateUnit.controller.js
// استبدل الدالة updateUnit الحالية بهذه النسخة المحدثة

const updateUnit = catchAsync(async (req, res, next) => {
  const unit = await RealEstateUnit.findByPk(req.params.id, {
    include: [{ 
      model: Building, 
      as: 'building'
    }]
  });
  
  if (!unit) {
    return next(new AppError('الوحدة غير موجودة', 404));
  }
  
  // If user is a manager, verify they belong to the same company
  if (req.user.role === 'manager') {
    if (unit.building.companyId !== req.user.companyId) {
      return next(new AppError('غير مصرح لك بتعديل وحدات لا تنتمي لشركتك', 403));
    }
  }
  
  const { 
    buildingId,
    ownerId,
    unitNumber, 
    unitType,
    unitLayout,
    floor, 
    area, 
    bathrooms,
    parkingNumber,
    price, 
    status, 
    description 
  } = req.body;
  
  // ✅ التحقق من حالة الوحدة قبل السماح بالتحديث
  if (status && status !== unit.status) {
    // التحقق من وجود حجز نشط للوحدة
    const activeReservation = await Reservation.findOne({
      where: {
        unitId: unit.id,
        status: 'active',
        startDate: { [Op.lte]: new Date() },
        endDate: { [Op.gte]: new Date() }
      }
    });

    if (activeReservation) {
      // إذا كانت الوحدة مؤجرة حالياً، لا يمكن تغيير الحالة إلا إلى صيانة
      if (unit.status === 'rented' && status !== 'maintenance') {
        return next(new AppError(
          'لا يمكن تغيير حالة الوحدة المؤجرة إلا إلى "تحت الصيانة". العقد نشط حتى ' + 
          activeReservation.endDate, 
          400
        ));
      }

      // إذا كانت الوحدة تحت الصيانة وهناك عقد نشط، لا يمكن تحويلها إلى متاحة
      if (unit.status === 'maintenance' && status === 'available') {
        return next(new AppError(
          'لا يمكن تحويل الوحدة إلى "متاحة" أثناء وجود عقد نشط. العقد ينتهي في ' + 
          activeReservation.endDate, 
          400
        ));
      }

      // السماح فقط بالتحويل من rented إلى maintenance أو من maintenance إلى rented
      if (unit.status === 'rented' && status === 'maintenance') {
        console.log(`✅ تم السماح بتحويل الوحدة ${unit.unitNumber} من مؤجرة إلى صيانة`);
      } else if (unit.status === 'maintenance' && status === 'rented') {
        console.log(`✅ تم السماح بتحويل الوحدة ${unit.unitNumber} من صيانة إلى مؤجرة`);
      }
    }

    // إذا لم يكن هناك حجز نشط، التحقق من حجوزات منتهية لم يتم تحديث حالتها
    if (!activeReservation && unit.status === 'rented') {
      const expiredReservation = await Reservation.findOne({
        where: {
          unitId: unit.id,
          status: { [Op.in]: ['active', 'expired'] },
          endDate: { [Op.lt]: new Date() }
        },
        order: [['endDate', 'DESC']]
      });

      if (expiredReservation && expiredReservation.status === 'active') {
        // تحديث الحجز المنتهي تلقائياً
        await expiredReservation.update({ status: 'expired' });
        console.log(`🔄 تم تحديث حالة الحجز ${expiredReservation.id} إلى منتهي`);
      }
    }
  }
  
  // ✅ تخزين الحالة الأصلية للمقارنة
  const originalStatus = unit.status;
  
  // If buildingId is being updated, check if the new building exists
  if (buildingId && buildingId !== unit.buildingId) {
    const building = await Building.findByPk(buildingId);
    if (!building) {
      return next(new AppError('المبنى غير موجود', 404));
    }
    
    // If user is a manager, verify the new building belongs to their company
    if (req.user.role === 'manager' && building.companyId !== req.user.companyId) {
      return next(new AppError('غير مصرح لك بنقل الوحدة إلى مبنى لا ينتمي لشركتك', 403));
    }
  }
  
  // Validate owner if being changed
  let validatedOwnerId = unit.ownerId; // Keep current owner by default
  if (ownerId !== undefined) { // Allow setting to null or changing owner
    if (ownerId === null || ownerId === '') {
      validatedOwnerId = null; // Remove owner
    } else {
      const owner = await User.findByPk(ownerId);
      if (!owner) {
        return next(new AppError('المالك المحدد غير موجود', 404));
      }
      validatedOwnerId = ownerId;
    }
  }
  
  // Check for duplicate unit number if being changed
  if (unitNumber && unitNumber !== unit.unitNumber) {
    const targetBuildingId = buildingId || unit.buildingId;
    const existingUnit = await RealEstateUnit.findOne({
      where: {
        buildingId: targetBuildingId,
        unitNumber,
        id: { [Op.ne]: req.params.id } // Exclude current unit
      }
    });
    
    if (existingUnit) {
      return next(new AppError('رقم الوحدة موجود مسبقاً في هذا المبنى', 400));
    }
  }
  
  if (parkingNumber !== undefined && parkingNumber !== unit.parkingNumber) {
    if (parkingNumber) {
      // التحقق من عدم وجود تعارض مع موقف آخر
      const targetBuildingId = buildingId || unit.buildingId;
      const existingParkingUnit = await RealEstateUnit.findOne({
        where: {
          buildingId: targetBuildingId,
          parkingNumber,
          id: { [Op.ne]: req.params.id }
        }
      });

      
      // التحقق من النطاق المسموح
      const building = await Building.findByPk(targetBuildingId);
      const maxParkingNumber = building.internalParkingSpaces;
      
      if (parseInt(parkingNumber) > maxParkingNumber || parseInt(parkingNumber) < 1) {
        return next(new AppError(`رقم الموقف يجب أن يكون بين 1 و ${maxParkingNumber}`, 400));
      }
    }
  }
  
  // Update unit
  await unit.update({
    buildingId: buildingId || unit.buildingId,
    ownerId: validatedOwnerId,
    unitNumber: unitNumber || unit.unitNumber,
    unitType: unitType || unit.unitType,
    unitLayout: unitLayout !== undefined ? unitLayout : unit.unitLayout,
    floor: floor !== undefined ? floor : unit.floor,
    area: area !== undefined ? area : unit.area,
    bathrooms: bathrooms !== undefined ? bathrooms : unit.bathrooms,
    parkingNumber: parkingNumber !== undefined ? parkingNumber : unit.parkingNumber,
    price: price !== undefined ? price : unit.price,
    status: status || unit.status,
    description: description !== undefined ? description : unit.description
  });
  
  // ✅ التحقق من إنشاء طلب صيانة إضافي (في حالة فشل Hook)
  if (status === 'maintenance' && originalStatus !== 'maintenance') {
    console.log(`🔧 التحقق من إنشاء طلب صيانة للوحدة ${unit.unitNumber}...`);
    
    // انتظار قصير للسماح للـ Hook بالعمل
    setTimeout(async () => {
      const maintenanceOrder = await ensureMaintenanceOrder(unit.id);
      if (maintenanceOrder) {
        console.log(`✅ تأكيد: طلب صيانة ${maintenanceOrder.id} جاهز للوحدة ${unit.unitNumber}`);
      }
    }, 1000);
  }
  
  // Fetch the updated unit with owner and building details
  const updatedUnit = await RealEstateUnit.findByPk(req.params.id, {
    include: [
      {
        model: Building,
        as: 'building',
        attributes: ['id', 'name', 'address']
      },
      {
        model: User,
        as: 'owner',
        attributes: ['id', 'fullName', 'email', 'phone'],
        required: false
      }
    ]
  });
  
  // ✅ إضافة معلومات حول طلب الصيانة في الاستجابة
  let responseData = {
    unit: updatedUnit,
    maintenanceOrderCreated: false
  };
  
  if (status === 'maintenance' && originalStatus !== 'maintenance') {
    responseData.maintenanceOrderCreated = true;
    responseData.message = 'تم تحديث حالة الوحدة إلى صيانة وإنشاء طلب صيانة تلقائي';
  }
  
  res.status(200).json({
    status: 'success',
    data: responseData
  });
});
// ✅ دالة جديدة للحصول على طلبات الصيانة للوحدة
const getUnitMaintenanceOrders = catchAsync(async (req, res, next) => {
  const unitId = req.params.id;
  
  // التحقق من وجود الوحدة
  const unit = await RealEstateUnit.findByPk(unitId, {
    include: [{
      model: Building,
      as: 'building'
    }]
  });
  
  if (!unit) {
    return next(new AppError('الوحدة غير موجودة', 404));
  }
  
  // التحقق من الصلاحيات
  if (req.user.role === 'manager' && unit.building.companyId !== req.user.companyId) {
    return next(new AppError('غير مصرح لك بعرض طلبات صيانة هذه الوحدة', 403));
  }
  
  // البحث عن جميع الحجوزات للوحدة
  const reservations = await Reservation.findAll({
    where: { unitId: unit.id },
    attributes: ['id']
  });
  
  const reservationIds = reservations.map(r => r.id);
  
  if (reservationIds.length === 0) {
    return res.status(200).json({
      status: 'success',
      results: 0,
      data: []
    });
  }
  
  // البحث عن طلبات الصيانة
  const maintenanceOrders = await ServiceOrder.findAll({
    where: {
      reservationId: { [Op.in]: reservationIds },
      serviceType: 'maintenance'
    },
    include: [
      { model: User, as: 'user', attributes: ['id', 'fullName', 'phone'] },
      { 
        model: Reservation, 
        as: 'reservation',
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'fullName', 'phone']
        }]
      }
    ],
    order: [['createdAt', 'DESC']]
  });
  
  res.status(200).json({
    status: 'success',
    results: maintenanceOrders.length,
    data: {
      unit: {
        id: unit.id,
        unitNumber: unit.unitNumber,
        status: unit.status,
        building: unit.building
      },
      maintenanceOrders
    }
  });
});

// ✅ دالة لإنشاء طلب صيانة يدوياً
const createMaintenanceOrder = catchAsync(async (req, res, next) => {
  const unitId = req.params.id;
  const { description, serviceSubtype = 'general_maintenance' } = req.body;
  
  // فقط المديرون وعمال الصيانة يمكنهم إنشاء طلبات صيانة يدوياً
  if (!['admin', 'manager', 'maintenance'].includes(req.user.role)) {
    return next(new AppError('غير مصرح لك بإنشاء طلبات صيانة', 403));
  }
  
  // التحقق من وجود الوحدة
  const unit = await RealEstateUnit.findByPk(unitId, {
    include: [{
      model: Building,
      as: 'building'
    }]
  });
  
  if (!unit) {
    return next(new AppError('الوحدة غير موجودة', 404));
  }
  
  // التحقق من الصلاحيات للمدير
  if (req.user.role === 'manager' && unit.building.companyId !== req.user.companyId) {
    return next(new AppError('غير مصرح لك بإنشاء طلبات صيانة لهذه الوحدة', 403));
  }
  
  // البحث عن الحجز النشط
  const activeReservation = await Reservation.findOne({
    where: {
      unitId: unit.id,
      status: 'active'
    }
  });
  
  if (!activeReservation) {
    return next(new AppError('لا يوجد حجز نشط لهذه الوحدة - لا يمكن إنشاء طلب صيانة', 400));
  }
  
  // إنشاء طلب الصيانة
  const maintenanceOrder = await ServiceOrder.create({
    userId: req.user.id, // المستخدم الذي أنشأ الطلب
    reservationId: activeReservation.id,
    serviceType: 'maintenance',
    serviceSubtype,
    description: description || `طلب صيانة يدوي للوحدة ${unit.unitNumber}`,
    status: 'pending',
    serviceHistory: [{
      status: 'pending',
      date: new Date().toISOString(),
      changedBy: req.user.id,
      changedByRole: req.user.role,
      changedByName: req.user.fullName || req.user.username,
      note: 'طلب صيانة يدوي'
    }]
  });
  
  // تحديث حالة الوحدة إلى صيانة إذا لم تكن كذلك
  if (unit.status !== 'maintenance') {
    await unit.update({ status: 'maintenance' });
  }
  
  // إرجاع التفاصيل الكاملة
  const createdOrder = await ServiceOrder.findByPk(maintenanceOrder.id, {
    include: [
      { model: User, as: 'user', attributes: ['id', 'fullName', 'phone'] },
      { 
        model: Reservation, 
        as: 'reservation',
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'fullName', 'phone']
        }]
      }
    ]
  });
  
  res.status(201).json({
    status: 'success',
    message: 'تم إنشاء طلب الصيانة بنجاح',
    data: createdOrder
  });
});

// باقي الدوال الموجودة بدون تغيير...

// Get all units
const getAllUnits = catchAsync(async (req, res, next) => {
  // المستأجرون لا يمكنهم رؤية كل الوحدات
  if(req.user.role === 'tenant') {
    return next(new AppError('غير مصرح لك بعرض جميع الوحدات', 403));
  }
  
  let whereCondition = {};
  let includeOptions = [
    { 
      model: Building, 
      as: 'building',
      include: [
        { 
          model: Company, 
          as: 'company',
          attributes: ['id', 'name', 'companyType', 'email', 'phone', 'address']
        }
      ]
    },
    {
      model: User,
      as: 'owner',
      attributes: ['id', 'fullName', 'email', 'phone', 'whatsappNumber', 'idNumber'],
      required: false
    }
  ];
  
  // التحكم بالصلاحيات حسب الدور
  if (req.user.role === 'manager' || req.user.role === 'accountant' || req.user.role === 'maintenance') {
    if (!req.user.companyId) {
      return next(new AppError('المستخدم غير مرتبط بأي شركة', 403));
    }
    includeOptions[0].where = { companyId: req.user.companyId };
  }
  
  if (req.user.role === 'owner') {
    whereCondition.ownerId = req.user.id;
  }
  
  // جلب الوحدات مع جميع المعلومات
  const units = await RealEstateUnit.findAll({
    where: whereCondition,
    include: includeOptions,
    order: [['createdAt', 'DESC']]
  });
  
  // تحويل البيانات لإضافة المعلومات المطلوبة
  const unitsWithCompleteInfo = units.map(unit => {
    const unitData = unit.toJSON();
    
    return {
      // معلومات الوحدة الأساسية
      id: unitData.id,
      buildingId: unitData.buildingId,
      ownerId: unitData.ownerId,
      unitNumber: unitData.unitNumber,
      unitType: unitData.unitType,
      unitLayout: unitData.unitLayout,
      floor: unitData.floor,
      area: unitData.area,
      bathrooms: unitData.bathrooms,
      parkingNumber: unitData.parkingNumber,
      price: unitData.price,
      status: unitData.status,
      description: unitData.description,
      createdAt: unitData.createdAt,
      updatedAt: unitData.updatedAt,
      
      // ✅ معلومات المالك المستخرجة
      ownerName: unitData.owner ? unitData.owner.fullName : null,
      ownerEmail: unitData.owner ? unitData.owner.email : null,
      ownerPhone: unitData.owner ? unitData.owner.phone : null,
      ownerWhatsapp: unitData.owner ? unitData.owner.whatsappNumber : null,
      ownerIdNumber: unitData.owner ? unitData.owner.idNumber : null,
      
      // ✅ معلومات المبنى المستخرجة
      buildingName: unitData.building ? unitData.building.name : null,
      buildingAddress: unitData.building ? unitData.building.address : null,
      buildingType: unitData.building ? unitData.building.buildingType : null,
      totalFloors: unitData.building ? unitData.building.totalFloors : null,
      totalUnits: unitData.building ? unitData.building.totalUnits : null,
      internalParkingSpaces: unitData.building ? unitData.building.internalParkingSpaces : null,
      
      // ✅ معلومات الشركة المستخرجة
      companyId: unitData.building?.company ? unitData.building.company.id : null,
      companyName: unitData.building?.company ? unitData.building.company.name : null,
      companyType: unitData.building?.company ? unitData.building.company.companyType : null,
      companyEmail: unitData.building?.company ? unitData.building.company.email : null,
      companyPhone: unitData.building?.company ? unitData.building.company.phone : null,
      companyAddress: unitData.building?.company ? unitData.building.company.address : null,
      
      // الكائنات الأصلية للمرجعية (اختيارية)
      building: unitData.building,
      owner: unitData.owner
    };
  });
  
  // إضافة إحصائيات للمالك
  let additionalInfo = {};
  if (req.user.role === 'owner') {
    const [
      availableCount,
      rentedCount,
      maintenanceCount,
      totalRevenue
    ] = await Promise.all([
      RealEstateUnit.count({ where: { ownerId: req.user.id, status: 'available' } }),
      RealEstateUnit.count({ where: { ownerId: req.user.id, status: 'rented' } }),
      RealEstateUnit.count({ where: { ownerId: req.user.id, status: 'maintenance' } }),
      RealEstateUnit.sum('price', { where: { ownerId: req.user.id, status: 'rented' } })
    ]);
    
    additionalInfo = {
      ownerStats: {
        totalUnits: unitsWithCompleteInfo.length,
        availableUnits: availableCount,
        rentedUnits: rentedCount,
        maintenanceUnits: maintenanceCount,
        monthlyRevenue: totalRevenue || 0,
        occupancyRate: unitsWithCompleteInfo.length > 0 ? 
          ((rentedCount / unitsWithCompleteInfo.length) * 100).toFixed(2) : 0
      }
    };
  }
  
  res.status(200).json({
    status: 'success',
    results: unitsWithCompleteInfo.length,
    data: unitsWithCompleteInfo,
    ...additionalInfo
  });
});

const getAvailableUnits = catchAsync(async (req, res, next) => {
  try {
    console.log("getAvailableUnits function called");
    console.log("Query parameters:", req.query);
    console.log("User:", req.user);
    
    // Get building ID from query
    const { buildingId } = req.query;
    
    // Build filter object
    const filter = {
      status: 'available'
    };
    
    // Add building filter if provided
    if (buildingId !== undefined) {
      filter.buildingId = parseInt(buildingId);
      console.log("Filtering by buildingId:", buildingId);
    }
    
    // Include options for eager loading related models
    const includeOptions = [
      { 
        model: Building, 
        as: 'building',
        include: [
          { 
            model: Company, 
            as: 'company',
            attributes: ['id', 'name', 'companyType', 'email', 'phone', 'address']
          }
        ]
      },
      {
        model: User,
        as: 'owner',
        attributes: ['id', 'fullName', 'email', 'phone', 'whatsappNumber', 'idNumber'],
        required: false
      }
    ];
    
    // If user is a manager, filter by their company ID
    if (req.user && req.user.role === 'manager' && req.user.companyId) {
      console.log("Manager filter applied, companyId:", req.user.companyId);
      includeOptions[0].where = { companyId: req.user.companyId };
    }
    
    // If user is owner, show only their available units
    if (req.user && req.user.role === 'owner') {
      filter.ownerId = req.user.id;
    }
    
    console.log("Final filter:", JSON.stringify(filter));
    console.log("Include options:", JSON.stringify(includeOptions));
    
    // Find all available units matching the criteria
    const availableUnits = await RealEstateUnit.findAll({
      where: filter,
      include: includeOptions,
      order: [['createdAt', 'DESC']]
    });
    
    console.log("Query successful, found units:", availableUnits.length);
    
    // تحويل البيانات لإضافة المعلومات المطلوبة
    const unitsWithCompleteInfo = availableUnits.map(unit => {
      const unitData = unit.toJSON();
      
      return {
        // معلومات الوحدة الأساسية
        id: unitData.id,
        buildingId: unitData.buildingId,
        ownerId: unitData.ownerId,
        unitNumber: unitData.unitNumber,
        unitType: unitData.unitType,
        unitLayout: unitData.unitLayout,
        floor: unitData.floor,
        area: unitData.area,
        bathrooms: unitData.bathrooms,
        parkingNumber: unitData.parkingNumber,
        price: unitData.price,
        status: unitData.status,
        description: unitData.description,
        createdAt: unitData.createdAt,
        updatedAt: unitData.updatedAt,
        
        // ✅ معلومات المالك المستخرجة
        ownerName: unitData.owner ? unitData.owner.fullName : null,
        ownerEmail: unitData.owner ? unitData.owner.email : null,
        ownerPhone: unitData.owner ? unitData.owner.phone : null,
        ownerWhatsapp: unitData.owner ? unitData.owner.whatsappNumber : null,
        ownerIdNumber: unitData.owner ? unitData.owner.idNumber : null,
        
        // ✅ معلومات المبنى المستخرجة
        buildingName: unitData.building ? unitData.building.name : null,
        buildingAddress: unitData.building ? unitData.building.address : null,
        buildingType: unitData.building ? unitData.building.buildingType : null,
        buildingNumber: unitData.building ? unitData.building.buildingNumber : null,
        totalFloors: unitData.building ? unitData.building.totalFloors : null,
        totalUnits: unitData.building ? unitData.building.totalUnits : null,
        internalParkingSpaces: unitData.building ? unitData.building.internalParkingSpaces : null,
        
        // ✅ معلومات الشركة المستخرجة
        companyId: unitData.building?.company ? unitData.building.company.id : null,
        companyName: unitData.building?.company ? unitData.building.company.name : null,
        companyType: unitData.building?.company ? unitData.building.company.companyType : null,
        companyEmail: unitData.building?.company ? unitData.building.company.email : null,
        companyPhone: unitData.building?.company ? unitData.building.company.phone : null,
        companyAddress: unitData.building?.company ? unitData.building.company.address : null,
        
        // الكائنات الأصلية للمرجعية (اختيارية)
        building: unitData.building,
        owner: unitData.owner
      };
    });
    
    // إضافة معلومات إضافية حسب الدور
    let additionalInfo = {};
    
    if (req.user && req.user.role === 'owner') {
      // إحصائيات للمالك
      const [totalOwned, rentedOwned, maintenanceOwned] = await Promise.all([
        RealEstateUnit.count({ where: { ownerId: req.user.id } }),
        RealEstateUnit.count({ where: { ownerId: req.user.id, status: 'rented' } }),
        RealEstateUnit.count({ where: { ownerId: req.user.id, status: 'maintenance' } })
      ]);
      
      additionalInfo = {
        ownerStats: {
          totalUnits: totalOwned,
          availableUnits: unitsWithCompleteInfo.length,
          rentedUnits: rentedOwned,
          maintenanceUnits: maintenanceOwned
        }
      };
    } else if (req.user && req.user.role === 'manager') {
      // إحصائيات للمدير
      const buildingIds = await Building.findAll({
        where: { companyId: req.user.companyId },
        attributes: ['id']
      }).then(buildings => buildings.map(b => b.id));
      
      const [totalInCompany, rentedInCompany] = await Promise.all([
        RealEstateUnit.count({ where: { buildingId: { [Op.in]: buildingIds } } }),
        RealEstateUnit.count({ where: { buildingId: { [Op.in]: buildingIds }, status: 'rented' } })
      ]);
      
      additionalInfo = {
        companyStats: {
          totalUnits: totalInCompany,
          availableUnits: unitsWithCompleteInfo.length,
          rentedUnits: rentedInCompany,
          occupancyRate: totalInCompany > 0 ? ((rentedInCompany / totalInCompany) * 100).toFixed(2) : 0
        }
      };
    }
    
    // Send response
    res.status(200).json({
      status: 'success',
      results: unitsWithCompleteInfo.length,
      data: unitsWithCompleteInfo,
      ...additionalInfo
    });
  } catch (error) {
    console.error("Error in getAvailableUnits:", error);
    return next(new AppError('Error fetching available units: ' + error.message, 500));
  }
});

const getUnitById = catchAsync(async (req, res, next) => {
  const unit = await RealEstateUnit.findByPk(req.params.id, {
    include: [
      { 
        model: Building, 
        as: 'building',
        include: [
          { 
            model: Company, 
            as: 'company',
            attributes: ['id', 'name', 'companyType', 'email', 'phone', 'address']
          }
        ]
      },
      {
        model: User,
        as: 'owner',
        attributes: ['id', 'fullName', 'email', 'phone', 'whatsappNumber', 'idNumber'],
        required: false
      }
    ]
  });
  
  if (!unit) {
    return next(new AppError('لم يتم العثور على الوحدة', 404));
  }
  
  // تحقق إذا كان المستخدم مديرًا للشركة المالكة للوحدة
  if (req.user.role === 'manager') {
    if (!req.user.companyId || req.user.companyId !== unit.building.companyId) {
      return next(new AppError('غير مصرح لك بعرض هذه الوحدة', 403));
    }
  } else if (req.user.role === 'tenant') {
    // التحقق من وجود حجوزات للمستأجر لهذه الوحدة
    const hasReservation = await Reservation.findOne({
      where: { 
        userId: req.user.id,
        unitId: unit.id
      }
    });
    
    if (!hasReservation) {
      // هنا نقوم بفحص إضافي للتحقق من رقم الوحدة في جميع حجوزات المستأجر
      const userReservations = await Reservation.findAll({
        where: { userId: req.user.id },
        attributes: ['unitId']
      });
      
      const userUnitIds = userReservations.map(res => res.unitId);
      if (!userUnitIds.includes(unit.id)) {
        return next(new AppError('غير مصرح لك بعرض هذه الوحدة', 403));
      }
    }
  } else if (req.user.role === 'owner') {
    // المالك يمكنه فقط رؤية وحداته
    if (unit.ownerId !== req.user.id) {
      return next(new AppError('غير مصرح لك بعرض هذه الوحدة', 403));
    }
  }
  
  // تحويل البيانات لإضافة المعلومات المطلوبة
  const unitData = unit.toJSON();
  
  const unitWithCompleteInfo = {
    // معلومات الوحدة الأساسية
    id: unitData.id,
    buildingId: unitData.buildingId,
    ownerId: unitData.ownerId,
    unitNumber: unitData.unitNumber,
    unitType: unitData.unitType,
    unitLayout: unitData.unitLayout,
    floor: unitData.floor,
    area: unitData.area,
    bathrooms: unitData.bathrooms,
    parkingNumber: unitData.parkingNumber,
    price: unitData.price,
    status: unitData.status,
    description: unitData.description,
    createdAt: unitData.createdAt,
    updatedAt: unitData.updatedAt,
    
    // ✅ معلومات المالك المستخرجة
    ownerName: unitData.owner ? unitData.owner.fullName : null,
    ownerEmail: unitData.owner ? unitData.owner.email : null,
    ownerPhone: unitData.owner ? unitData.owner.phone : null,
    ownerWhatsapp: unitData.owner ? unitData.owner.whatsappNumber : null,
    ownerIdNumber: unitData.owner ? unitData.owner.idNumber : null,
    
    // ✅ معلومات المبنى المستخرجة
    buildingName: unitData.building ? unitData.building.name : null,
    buildingAddress: unitData.building ? unitData.building.address : null,
    buildingType: unitData.building ? unitData.building.buildingType : null,
    buildingNumber: unitData.building ? unitData.building.buildingNumber : null,
    totalFloors: unitData.building ? unitData.building.totalFloors : null,
    totalUnits: unitData.building ? unitData.building.totalUnits : null,
    internalParkingSpaces: unitData.building ? unitData.building.internalParkingSpaces : null,
    
    // ✅ معلومات الشركة المستخرجة
    companyId: unitData.building?.company ? unitData.building.company.id : null,
    companyName: unitData.building?.company ? unitData.building.company.name : null,
    companyType: unitData.building?.company ? unitData.building.company.companyType : null,
    companyEmail: unitData.building?.company ? unitData.building.company.email : null,
    companyPhone: unitData.building?.company ? unitData.building.company.phone : null,
    companyAddress: unitData.building?.company ? unitData.building.company.address : null,
    
    // الكائنات الأصلية للمرجعية
    building: unitData.building,
    owner: unitData.owner
  };
  
  // إضافة معلومات إضافية إذا كان مالك
  let additionalInfo = {};
  
  if (req.user.role === 'owner') {
    // معلومات إضافية للمالك عن هذه الوحدة
    const reservations = await Reservation.findAll({
      where: { unitId: unit.id },
      include: [{
        model: User,
        as: 'user',
        attributes: ['fullName', 'phone', 'email']
      }],
      order: [['createdAt', 'DESC']],
      limit: 5
    });
    
    const serviceOrders = await ServiceOrder.count({
      where: { status: 'pending' },
      include: [{
        model: Reservation,
        as: 'reservation',
        where: { unitId: unit.id }
      }]
    });
    
    additionalInfo = {
      unitHistory: {
        recentReservations: reservations,
        pendingServiceOrders: serviceOrders
      }
    };
  }
  
  res.status(200).json({
    status: 'success',
    data: unitWithCompleteInfo
  });
});

// Create new unit
const createUnit = catchAsync(async (req, res, next) => {
  const { 
    buildingId, 
    ownerId,
    unitNumber, 
    unitType,
    unitLayout,
    floor, 
    area, 
    bathrooms, 
    price, 
    parkingNumber, 
    status, 
    description 
  } = req.body;
  
  // Check if building exists
  const building = await Building.findByPk(buildingId);
  if (!building) {
    return next(new AppError('المبنى غير موجود', 404));
  }
  
  // If user is a manager, verify they belong to the same company
  if (req.user.role === 'manager') {
    if (building.companyId !== req.user.companyId) {
      return next(new AppError('غير مصرح لك بإنشاء وحدات في مبنى لا ينتمي لشركتك', 403));
    }
  }
  
  // Validate owner if provided
  let validatedOwnerId = null;
  if (ownerId) {
    const owner = await User.findByPk(ownerId);
    if (!owner) {
      return next(new AppError('المالك المحدد غير موجود', 404));
    }
    
    validatedOwnerId = ownerId;
  }
  
  // Check for duplicate unit number in the same building
  const existingUnit = await RealEstateUnit.findOne({
    where: {
      buildingId,
      unitNumber
    }
  });
  
  if (existingUnit) {
    return next(new AppError('رقم الوحدة موجود مسبقاً في هذا المبنى', 400));
  }
  
  if (parkingNumber) {
    // التحقق من أن رقم الموقف لم يُستخدم من قبل في نفس المبنى
    const existingParkingUnit = await RealEstateUnit.findOne({
      where: {
        buildingId,
        parkingNumber
      }
    });
    
    if (existingParkingUnit) {
      return next(new AppError(`رقم الموقف ${parkingNumber} مستخدم مسبقاً في هذا المبنى`, 400));
    }
    
    const maxParkingNumber = building.internalParkingSpaces;
    
    if (parseInt(parkingNumber) > maxParkingNumber || parseInt(parkingNumber) < 1) {
      return next(new AppError(`رقم الموقف يجب أن يكون بين 1 و ${maxParkingNumber}`, 400));
    }
  }
  
  const newUnit = await RealEstateUnit.create({
    buildingId,
    ownerId: validatedOwnerId,
    unitNumber,
    unitType,
    unitLayout,
    floor,
    area,
    bathrooms,
    parkingNumber, 
    price,
    status: status || 'available',
    description
  });
  
  // Fetch the created unit with owner and building information
  const unitWithDetails = await RealEstateUnit.findByPk(newUnit.id, {
    include: [
      {
        model: Building,
        as: 'building',
        attributes: ['id', 'name', 'address']
      },
      {
        model: User,
        as: 'owner',
        attributes: ['id', 'fullName', 'email', 'phone'],
        required: false
      }
    ]
  });
  
  res.status(201).json({
    status: 'success',
    data: unitWithDetails
  });
});

// Delete unit
const deleteUnit = catchAsync(async (req, res, next) => {
  const unit = await RealEstateUnit.findByPk(req.params.id);
  
  if (!unit) {
    return next(new AppError('Unit not found', 404));
  }
  
  await unit.destroy();
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Get units by building ID
const getUnitsByBuildingId = catchAsync(async (req, res, next) => {
  const buildingId = req.params.buildingId;
  
  // Check if building exists
  const building = await Building.findByPk(buildingId);
  if (!building) {
    return next(new AppError('Building not found', 404));
  }
  
  const units = await RealEstateUnit.findAll({
    where: { buildingId }
  });
  
  res.status(200).json({
    status: 'success',
    results: units.length,
    data: units
  });
});

// Get available parking spots for a building
const getAvailableParkingSpots = catchAsync(async (req, res, next) => {
  const { buildingId } = req.params;
  
  // التحقق من وجود المبنى
  const building = await Building.findByPk(buildingId);
  if (!building) {
    return next(new AppError('المبنى غير موجود', 404));
  }
  
  // التحقق من الصلاحيات للمدير
  if (req.user.role === 'manager' && req.user.companyId !== building.companyId) {
    return next(new AppError('غير مصرح لك بعرض مواقف هذا المبنى', 403));
  }
  
  // الحصول على جميع المواقف المستخدمة في هذا المبنى
  const usedParkingSpots = await RealEstateUnit.findAll({
    where: { 
      buildingId,
      parkingNumber: { [Op.ne]: null }
    },
    attributes: ['parkingNumber']
  });
  
  const usedNumbers = usedParkingSpots
    .map(unit => unit.parkingNumber)
    .filter(num => num !== null && num !== '');
  
  // إنشاء قائمة المواقف المتاحة
  const totalParkingSpaces = building.internalParkingSpaces;
  const availableSpots = [];
  
  for (let i = 1; i <= totalParkingSpaces; i++) {
    const parkingNumber = i.toString();
    if (!usedNumbers.includes(parkingNumber)) {
      availableSpots.push(parkingNumber);
    }
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      buildingId,
      buildingName: building.name,
      totalParkingSpaces,
      usedParkingSpaces: usedNumbers.length,
      availableParkingSpaces: availableSpots.length,
      availableSpots,
      usedSpots: usedNumbers
    }
  });
});

module.exports = {
  getAllUnits,
  getUnitById,
  createUnit,
  updateUnit,
  deleteUnit,
  getUnitsByBuildingId,
  getAvailableUnits,
  getAvailableParkingSpots,
  // ✅ الدوال الجديدة للصيانة
  getUnitMaintenanceOrders,
  createMaintenanceOrder,
  ensureMaintenanceOrder
};